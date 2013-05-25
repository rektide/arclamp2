var buffer= require("buffer").Buffer,
  stream= require("stream"),
  util= require("util"),
  clarinet= require("clarinet"),
  ch= require("./ClarinetHelper")

var WILDCARD= "."
var WILDERCARD= ".."

function JsonPath(){
	if(!(this instanceof JsonPath)){
		return new JsonPath()
	}
	stream.Transform.call(this,{objectMode:true})

	//this.input= input // input stream
	this.stack= [] // address cursor

	// tracking engine:
	//this.good= []
	//this.bad= []
	this.up= []
	this.down= []
	this.els= []

	return this
}
util.inherits(JsonPath, stream.Transform)
JsonPath.prototype._transform= _transform // ???? Necessary ????
JsonPath.prototype._isArray= _isArray
JsonPath.prototype._top= _top

var STATES= doFlags(["els","down","up"])
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

function _transform(chunk,outputFn,callback){
	var token= chunk[0],
	  val= chunk[1]
	if(token == ch.value){
		var _top= this._top(),
		  _isArr= this._isArray(_top)
		if(_isArr){
			++this.stack[this.stack.length-1]
		}
		for(var t in this.els){
			this.els[t].call(this,_top,token,STATES.els,_isArr)
		}
	}else if(token == ch.key){
		this.stack[this.stack.length-1]= val
	}else if(token == ch.closearray || token == ch.closeobject){
		var d= this.stack.pop()
		for(var t in this.down){
			this.down[t].call(this,d,token==ch.closearray,STATE.down)
		}
	}else if(token == ch.openarray){
		var _oldTop= this._top()
		this.stack.push(0)
		for(var t in this.up){
			this.up[t](this,_oldTop,true,STATES.up)
		}
	}else if(token == ch.openobject){
		var _oldTop= this._top()
		this.stack.push(val)
		for(var t in this.up){
			this.up[t](this,_oldTop,false,STATES.up)
		}
	}
	console.log("STACK",this.stack)
	callback()
}

function _isArray(_top){
	return !isNaN(_top===undefined?this._top():_top)
}

function _top(){
	return this.stack[this.stack.length-1]
}

function JsonPathExpression(expression){
	this.frags= []
	this.frag= 0

	var exprs= module.exports.parse(expression).split(";")
	for(var i= 1; i< exprs.length; ++i){
		var expr= exprs[i]
		if(expr == "..")
			this.frags.push(new Any())
		else if(expr[0] == "?" && expr[1] == "("  && expr[expr.length-1] == ")")
			this.frags.push(new Filter(expr.substring(2,expr.length-1)
		else if(expr[0] == "(" && expr[expr.length-1] == ")")
			this.frags.push(new Filter(expr.substring(1,expr.length-1)
		else{
			var exprRange= expr.split(":",2),
			  exprIndexes= expr.split(",",2),
			  hasRange == exprRange.length == 2,
			  hasIndexes = exprIndexes.length == 2
			if(hasRange && hasIndexes)
				throw "Unexpected parameter: "+expr
			else if(hasRange)
				this.frags.push(new Range(parseInt(exprRange[0])||"",parseInt(exprRange[1])||""))
			else if(hasIndexes){
				for(var j in exprIndexes){
					var val= exprIndexes[j]= parseInt(exprIndexes[j])
					if(Number.isNaN(val))
						throw "Unexpected parameter: "+expr
				}
				this.frags.push(new Indexes(exprIndexes))
			}else
				this.frags.push(new Tag(expr))
		}
	}
}

function Tag(name){
	return function (e,isArr,state){
		if(e==name){
		}
	}
}

function Any(){
	this.handler= function(a,b,state){
		if(state == STATE.els){
		}else if(state == STATE.up){
		}
	}
	this.handlerMatch= STATE.els+STATE.up
}

function Filter(filter){
	this.filter= filter
	this.handler= function()
	this.handlerMatch= STATE.up
}

function Indexes(indexes){
	this.indexes= indexes
	this.handler= function()
	this.handlerMatch= State.els
}

function Range(start,end){
	this.start= start
	this.end= end
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
