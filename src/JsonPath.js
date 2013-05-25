var buffer= require("buffer").Buffer,
  stream= require("stream"),
  util= require("util"),
  clarinet= require("clarinet"),
  ch= require("./ClarinetHelper")

var WILDCARD= "."
var WILDERCARD= ".."

/**
 push for multiset
*/
function pushm(hash,key,newVal){
	try{
		hash[key].push(newVal)
	}catch(ex){
		hash[key]= [newVal]
	}
	return hash
}

/**
  watches an JsonPath stream evaluating expressions
*/
function JsonPath(){
	if(!(this instanceof JsonPath)){
		return new JsonPath()
	}
	stream.Transform.call(this,{objectMode:true})

	//this.input= input // input stream
	this.stack= [] // address cursor

	// tracking engine:
	for(var i in STATES){
		var stateName= STATES[i]
		this["all"+stateName]= []
		this[stateName+"s"]= []
	}

	// rootmost single object being created
	this.ctx= null
	this.ctx

	this.exprs= new Map()
	return this
}
util.inherits(JsonPath, stream.Transform)
JsonPath.prototype._transform= _transform // ???? Necessary ????
JsonPath.prototype._isArray= _isArray
JsonPath.prototype._top= _top
JsonPath.prototype._cycle= _cycle
JsonPath.prototype._handles= _handles
JsonPath.prototype._stackState= _stackState

var STATES= doFlags(["key","primitive","open","close"])
STATES.findGlobal= function(state){return "all"+STATES[state]}
STATES.findLocal= function(state){return STATES[state]+"s"}
STATES.find= function(state,n){return isNaN(n)? STATES.findGlobal(state): STATES.findLocal(state)}
function doEnum(e){
	for(var i= 0; i< e.length; ++i)
		e[e[i].toUpperCase()]= e[i]
	return e
}

function doFlags(e){
	var o= {}
	for(var i= 0; i< e.length; ++i){
		var name= e[i],
		  val= Math.pow(2,i)
		o[val]= name
		o[name]= val
	}
	return o
}

function _stackState(extra){
	var extraDefined= extra==defined,
	  stack= this.stack,
	  depth= stack.length,
	  returnArray= extraDefined?[depth,,,]:[depth,,],
	  last= rv[1]= stack[depth-1]
	rv[2]= this._isArray(last)
	if(extraDefined)
		returnArray.push(extra)
	return returnArray
}

function _transform(chunk,outputFn,callback){
	var token= chunk[0],
	  val= chunk[1],
	  ss= this._stackState(val) // depth, last, isArr
	if(token == ch.value){
		if(ss[2]){
			++this.stack[ss[0]-1]
		}
		this._cycle(undefined,ss,STATES.val)
	}else if(token == ch.key){
		this.stack[this.stack.length-1]= val
		this._cycle(undefined,ss,STATES.key)
	// open close array
	}else if(token == ch.openarray){
		this.stack.push(0)
		this._cycle(undefined,ss,STATES.open,true)
	}else if(token == ch.closearray){
		var d= this.stack.pop()
		this._cycle(d,ss,STATES.close,true)
	// open close object, dupe of array
	}else if(token == ch.openobject){
		this.stack.push(val)
		this._cycle(undefined,ss,STATES.open,false)
	}else if(token == ch.closeobject){
		this._cycle(d,ss,STATES.close,false)
	}
	console.log("STACK",this.stack)
	callback()
}

function _cycle(ctx,ss,state,isArr){
	var stateName= STATE[state],
	  local= this[stateName+"s"][depth],
	  global= this["all"+stateName]
	for(var t in local){
		local[t].call(this,ctx,ss,state,isArr)
	}
	for(var t in global){
		global[t].call(this,ctx,ss,state,isArr)
	}
}

function _isArray(_top){
	return !isNaN(_top===undefined?this._top():_top)
}

function _top(){
	return this.stack[this.stack.length-1]
}

/**
  lookup handles at a specific local level or in the global
*/
function _handles(state,n){
	var name= this.find(state,n)
	return isNaN(n)? this[name]: this[name][n]
}


function JsonPathExpression(stack,expression){
	this.stack= stack
	this.frags= [MultipleArraysRoot(this)]
	this.frag= 0

	var exprs= module.exports.parse(expression).split(";")
	for(var i= 1; i< exprs.length; ++i){
		var expr= exprs[i]
		if(expr == "..")
			this.frags.push(new Any(this))
		else if(expr[0] == "?" && expr[1] == "("  && expr[expr.length-1] == ")")
			this.frags.push(new Filter(this,expr.substring(2,expr.length-1)
		else if(expr[0] == "(" && expr[expr.length-1] == ")")
			this.frags.push(new Filter(this,expr.substring(1,expr.length-1)
		else{
			var exprRange= expr.split(":",2),
			  exprIndexes= expr.split(",",2),
			  hasRange == exprRange.length == 2,
			  hasIndexes = exprIndexes.length == 2
			if(hasRange && hasIndexes)
				throw "Unexpected parameter: "+expr
			else if(hasRange)
				this.frags.push(new Range(this,parseInt(exprRange[0])||"",parseInt(exprRange[1])||""))
			else if(hasIndexes){
				for(var j in exprIndexes){
					var val= exprIndexes[j]= parseInt(exprIndexes[j])
					if(Number.isNaN(val))
						throw "Unexpected parameter: "+expr
				}
				this.frags.push(new Indexes(this,exprIndexes))
			}else
				this.frags.push(new Tag(this,expr))
		}
	}
}

function JsonFragment(exprs){
	this.exprs= exprs
	return this
}

JsonFragment.prototype.install= function(depth){
	this.depth= depth
	this.installed= []
	if(this._install)
		this._install(depth)
}

JsonFragment.prototype.success= function(){
	
}

JsonFragment.prototype.fail= function(){
}

JsonFragment.prototype.register= function(state,h,n){
	var stateName= STATES[state]
	if(isNaN(n)){
		if(this.installed)
			this.installed.push({state:state,h:h})
		pushm(this.stack,"all"+stateName,h)
	}else{
		if(this.installed)
			this.installed.push({state:state,h:h,n:n})
		pushm(this.stack[stateName+"s"],h,n)
	}
}
JsonFragment.prototype.unregister= function(state,h,n){
	var stateName= STATES[state]
	for(var h= 0; h< this.installed.length; ++h){
		var i= this.installed[h]
		if(i.state == state && i.state == h && i.n == n){
			this.installed= this.installed.splice(h,1)
			--h
		}
	}
	var stackSpot= isNaN(n)? this.stack["all"+stateName]: this.stack[stateName+"s"][n]
	for(var i in stackSpot){
		var hiter= stackSpot[i]
		if(hiter == h)
			stackSpot.splice(i,1)
	}
}

JsonFragment.prototype.drop= function(stack,currentDepth){
	while(this.installed && this.installed.length){
		var last= this.installed[this.installed.length-1]
		this.unregister(last.state,last.h,last.n)
	}
	if(this._drop)
		this._drop(stack,currentDepth)
}

function _callSuper(klass,that,args){
	if(!(args instanceof array))
		args= [args]
	klass.super_.apply(that,args)
}

function Tag(exprs,tag){
	this.tag= tag
	_callSuper(Tag,this,exprs)
	return this
}
Tag.prototype.awaitTag= function(ctx,ss,state,isArr){
	if(ss[3] == this.tag)
		this.success()
}
Tag.prototype._install= function(depth){
	this.register(STATES.key,this.awaitTag,depth)
}
util.inherits(Tag, JsonFragment)

function Any(exprs){
	_callSuper(Any,this,exprs)
	return this
}
util.inherits(Any, JsonFragment)

function Filter(exprs,filter){
	this.filter= filter
	_callSuper(Filter,this,exprs)
	return this
}
util.inherits(Filter, JsonFragment)

function Indexes(exprs,indexes){
	this.indexes= indexes
	_callSuper(Indexes,this,exprs)
	return this
}
util.inherits(Indexes, JsonFragment)

function Range(exprs,start,end){
	this.start= start
	this.end= end
	_callSuper(Range,this,exprs)
	return this
}
util.inherits(Range, JsonFragment)

/**
  MultiplArrayRoot carries an uninitialized JsonExpression from zero stack state to multiple array states.
*/
function MultipleArraysRoot(exprs){
	_callSuper(MultipleArraysRoot,this,exprs)
	return this
}
util.inherits(MultipleArraysRoot, JsonFragment)
MultipleArraysRoot.prototype._install= function(stack,i){
	this.register(STATES.open,this.awaitRootGood,i)
}
MultipleArraysRoot.prototype.awaitRootGood= function(ctx,ss,state,isArr){
	if(isArr){
		this.installNext(ctx,ss,state,isArr)
		// drop
		// rebuild
		// TODO: 
	}
}

module.exports= JsonPath


module.exports.parse= function(expr){
	var subx= []
	// https://github.com/s3u/JSONPath/blob/ebcb8d4d06a0f27b6458aebeef98db37ea0de088/lib/jsonpath.js#L23-L27
        var ret = expr.replace(/[\['](\??\(.*?\))[\]']/g, function($0,$1){return "[#"+(subx.push($1)-1)+"]";})
          .replace(/'?\.'?|\['?/g, ";")
          .replace(/;;;|;;/g, ";..;")
          .replace(/;$|'?\]|'$/g, "")
          .replace(/#([0-9]+)/g, function($0,$1){return subx[$1];});
	return ret
}
