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
	stream.Transform.call(this)

	//this.input= input // input stream
	this.stack= [] // address cursor

	// tracking engine:
	this.good= []
	this.bad= []

	return this
}
util.inherits(JsonPath, stream.Transform)
JsonPath.prototype._transform= _transform
JsonPath.prototype._isArray= _isArray
JsonPath.prototype._top= _top

function _transform(chunk,outputFn,callback){
	var token= chunk[0],
	  val= chunk[1]
	if(token == ch.value){
		if(this._isArray()){
			++this.stack[this.stack.length-1]
		}
	}else if(token == ch.key){
		this.stack[this.stack.length-1]= val
	}else if(token == ch.closearray || token == ch.closeobject){
		this.stack.pop()
	}else if(token == ch.openarray){
		this.stack.push(0)
	}else if(token == ch.openobject){
		this.stack.push(val)
	}
	console.debug("STACK",this.stack)
	callback()
}

function _isArray(){
	return !isNaN(this._top())
}

function _top(){
	return this.stack[this.stack.length-1]
}

function JsonPathExpression(expression){
	this.expression= expression
	this.badFork= null
}

module.exports= JsonPath
