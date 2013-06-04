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
	for(var stateName in STATES.nameKeys){
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
JsonPath.prototype.expr= jsonExpr
JsonPath.prototype._pushHandle= _pushHandle
JsonPath.prototype._dropHandle= _dropHandle
JsonPath.prototype._transform= _transform
JsonPath.prototype._isArray= _isArray
JsonPath.prototype._top= _top
JsonPath.prototype._cycle= _cycle
JsonPath.prototype._handles= _handles // accessor function
JsonPath.prototype._stackState= _stackState

var STATES= ["key","primitive","open","close"]
STATES.flags= doPermute(STATES,null,undefined,true) // { 1:key, 2:primitive, 4:open, 8:close, key:1, primitive:2, open:4, close:8 }
STATES.flags.vals= doPermute(STATES,null,true,false) // [key.primitive,open,close] // i think this could probably be better- ordinal -> real
STATES.flags.ordinals= doPermute(STATES,null,true,true) // [key,primitive,,open,,,close]
STATES.flags.nameKeys= doPermute(STATES,null,false,true) // { key: 1, primitive: 2, .. }
STATES.flags.realToFlag= [1,2,4,8,16,32,64,128]
STATES= STATES.flags

STATES.findGlobal= function(state){return "all"+(isNaN(state)?state:STATES[state])}
STATES.findLocal= function(state){return (isNaN(state)?state:STATES[state])+"s"}
STATES.find= function(state,n){return isNaN(n)? STATES.findGlobal(state): STATES.findLocal(state)}

STATES.lookup= function(stack,state,n){
	var global= STATES.findGlobal(state),
	  local= STATES.findLocal(state),
	  localStack= stack[local]
	console.log("LOOKUP",state,global,local)
	return localStack?[
	  stack[global],
	  localStack[n]]: [stack[global]]

}

function doPermute(e,o,fwdRev,flags){
	o= o||(flags||fwdRev===false)?[]:{}
	var ind= flags? pow2: identity,
	  iter
	if(fwdRev===true)
		iter= setFwd
	else if(fwdRev===false)
		iter= setRev
	else if(fwdRev===undefined)
		iter= setBoth
	else
		throw "Invalid fwd/reverse argument"
	for(var i= 0; i< e.length; ++i){
		var el= e[i],
		  index= ind(i)
		iter(o,index,el)
	}
	return o
}

function identity(i){return i}
function pow2(i){return Math.pow(2,i)}

function setFwd(o,k,v){
	o[k]= v
}
function setRev(o,k,v){
	o[v]= k
}
function setBoth(o,k,v){
	o[k]= v
	o[v]= k
}

/**
  create a context object for a stack level.
  @param extra optional additional context to append on
  @param depth optional specific level of depth to get context for
  @returns an array of [depth,last element,isArray,extra] for stack[depth]
*/
function _stackState(extra){
	var extraDefined= extra!==undefined,
	  stack= this.stack,
	  depth= stack.length,
	  returnArray= extraDefined?[depth,,,extra]:[depth,,],
	  last= returnArray[1]= stack[depth-1],
	  isArr= returnArray[2]= this._isArray(last)
	returnArray._depth= _ssDepth
	returnArray._last= _ssLast
	returnArray._isArr= _ssIsArr
	returnArray._extra= _ssExtra
	return returnArray
}
function _ssDepth(){
	return this[0]
}
function _ssLast(){
	return this[1]
}
function _ssIsArr(){
	return this[2]
}
function _ssExtra(){
	return this[3]
}

// feed from incoming object stream
function _transform(chunk,outputFn,callback){
	var token= chunk[0],
	  val= chunk[1],
	  ss= this._stackState(val) // depth, last, isArr, json token value
	if(token == ch.value){
		this._cycle(undefined,ss,STATES.primitive)
		if(ss[2]){ // arrays position increments
			++this.stack[ss._depth()-1]
		}
	}else if(token == ch.key){
		this.stack[this.stack.length-1]= val
		this._cycle(undefined,ss,STATES.key)
	// open close array
	}else if(token == ch.openarray){
		this._cycle(undefined,ss,STATES.open,true)
		if(ss[2]){ // arrays position increments
			++this.stack[ss._depth()-1]
		}
		this.stack.push(0)
	}else if(token == ch.closearray){
		var d= this.stack.pop()
		this._cycle(d,ss,STATES.close,true)
	// open close object, dupe of array
	}else if(token == ch.openobject){
		this._cycle(undefined,ss,STATES.open,false)
		if(ss[2]){ // arrays position increments
			++this.stack[ss._depth()-1]
		}
		this.stack.push(val)
	}else if(token == ch.closeobject){
		var d= this.stack.pop()
		this._cycle(d,ss,STATES.close,false)
	}
	console.log("STACK",this.stack)
	callback()
}

function _cycle(ctx,ss,state,isArr){
	var lookup= STATES.lookup(this.stack,state,ss._depth())
	//var stateName= STATES[state],
	//  locals= this[stateName+"s"],
	//  local= locals?locals[ss[0]]:null,
	//  global= this["all"+stateName],
	//  lookup= [global,local]
	for(var t in lookup[1]){
		lookup[1][t].call(this,ctx,ss,state,isArr)
	}
	for(var t in lookup[0]){
		lookup[0][t].call(this,ctx,ss,state,isArr)
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

/**
  add a handler
  @param h handler
  @param state
  @param n a local depth to install at
  @param d optional offset for n
*/
function _pushHandle(h,state,n,d){
	if(isNaN(n)){
		pushm(this.stack,STATES.findGlobal(state),h)
	}else{
		pushm(this.stack[STATES.findLocal(state)],n+(d||0),h)
	}
}

function _dropHandle(h,state,n,d){
	var s
	if(isNaN(n)){
		s= this.stack[STATES.findGlobal(state)]
	}else{
		var ld= n+(d||0)
		s= this.stack[STATES.findLocal(state)][ld]
	}
	for(var i in s){
		if(h == s[i]){
			s.splice(i,1)
		}
	}
}

function jsonExpr(expr){
	return new JsonPathExpression(this,expr)
}

function JsonPathExpression(stack,expression,opts){
	this.stack= stack
	//this.frags= [MultipleArraysRoot(this)]
	this.frags= []
	this.frag= 0

	var exprs= module.exports.parse(expression).split(";")
	for(var i= 1; i< exprs.length; ++i){
		var expr= exprs[i]
		if(expr == "..")
			this.frags.push(new Any(this))
		else if(expr[0] == "?" && expr[1] == "("  && expr[expr.length-1] == ")")
			this.frags.push(new Filter(this,expr.substring(2,expr.length-1)))
		else if(expr[0] == "(" && expr[expr.length-1] == ")")
			this.frags.push(new Filter(this,expr.substring(1,expr.length-1)))
		else{
			var exprRange= expr.split(":",2),
			  exprIndexes= expr.split(",",2),
			  hasRange= exprRange.length == 2,
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
	return this
}

/**
  a singleton
*/
function JsonFragment(exprs,frag){
	this.exprs= exprs // JsonExpression
	this.frag= frag // ordinal number
	return this
}

/**
*/
function Tip(frag,previousTip){
	this.frag= frag
	this.previousTip= previousTip
	this.stackDepth= frag.exprs.stack.stack.length
	this.drop= null
	return this
}

/**
  produces a tip
*/
JsonFragment.prototype.install= function(previousTip){
	var tip= new Tip(this,previousTip)
	tip.install()
}

Tip.prototype.install= function(){
	this._installHandles()
	this._installDrop()
	this._installTip()
	this._installFrag()
}
prototype._installHandles= function(){
	for(var thi in this.frag.handles){
		var th= this.frag.handles[thi]
		this._installHandle(th)
	}
}
Tip.prototype._installDrop= function(){
	this._makeDropHandle()
	this._installHandle(this.drop)
}
Tip.prototype._installTip= function(){
	if(this._install)
		this._install()
}
Tip.prototype._installFrag= function(){
	if(this.frag._install)
		this.frag._install(this)
}

Tip.prototype._makeDropHandle= function(){
	var h= this.drop= (_dropHandle.bind(this))
	h.state= STATE.close
	h.d= 0
	return h
}
Tip.prototype._installHandle= function(h,state,n,d){
	this.frag.exprs.stack._pushHandle(h,state===undefined?h.state:state,n===undefined?h.d:n,d===undefined?this.stackDepth:d)
}

function _dropHandle= function(){
	this._dropHandles()
	this._dropDrop()
	this._dropTip()
	this._dropFrag()
}
Tip.prototype._dropHandles(){
	for(var thi in this.frag.handles){
		var th= this.frag.handles[thi]
		this._dropHandle(th)
	}
}
Tip.prototype._dropDrop(){
	this._dropHandle(this.drop)
}
Tip.prototype._dropTip(){
	if(!this._drop)
		return
	this._drop()
}
Tip.prototype._dropFrag(){
	if(!this.frag._drop)
	    return
	this.frag._drop(this)
}
Tip.prototype._dropHandle= function(h,state,n,d){
	this.frags.exprs.stack._dropHandle(h,state===undefined?h.state:state,n===undefined?state.d:n,d===undefined?this.stackDepth:d)
}


/**
  when a fragment succeeds
*/
Tip.prototype.success= function(){
	// install the next fragment at this depth
	this.findNextFrag().install(this)
	//this.frag.exprs.frags[this.exprs.frag+1].install(this.stack.depth,this.exprs.frags[this.exprs.frag],this)
}

Tip.prototype.findNextFrag= function(){
	var nextFrag= this.frags.exprs.frags[this.frag.frag+1]
	if(!nextFrag){
		console.warn("unhandled end of tip")
	}
	return nextFrag
}

/**
  when a fragment will no longer have activity
*/
Tip.prototype.end= function(){
	this.drop()
}

function _callSuper(klass,that,args){
	if(!(args instanceof Array))
		args= [args]
	klass.super_.apply(that,args)
}

function Tag(exprs,tag){
	_callSuper(Tag,this,exprs)
	this.tag= tag
	this.handles= [
		this.awaitTag
	]
	return this
}
util.inherits(Tag, JsonFragment)
Tag.prototype.awaitTag= function(ctx,ss,state,isArr){
	if(ss[3] == this.tag)
		this.success()
}

function Any(exprs){
	_callSuper(Any,this,exprs)
	return this
}
util.inherits(Any, JsonFragment)

Any.prototype.nextAny= function(){
	if(!this.nextFrag)
		this.nextFrag= this.exprs.frags[this.depth+1]
	return this.nextFrag
}

Any.prototype.awaitAny= function(){
	this.success()
}

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
	this.handles= [
		this.awaitRootGood
	]
	return this
}
util.inherits(MultipleArraysRoot, JsonFragment)
function awaitRootGood(ctx,ss,state,isArr){
	if(isArr){
		this.success(ctx,ss,state,isArr)
		// drop
		// rebuild
		// TODO: 
	}
}
awaitRootGood.state= STATES.open
awaitRootGood.d= 0
MultipleArraysRoot.prototype.awaitRootGood= awaitRootGood


/**
  SingleRoot processes a single value.
*/
function SingleRoot(exprs){
	_callSuper(SingleRoot,this,exprs)
	return this
}
util.inherits(SingleRoot, JsonFragment)

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
