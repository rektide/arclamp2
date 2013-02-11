var buffer= require("buffer").Buffer,
  stream= require("stream"),
  util= require("util"),
  clarinet= require("clarinet")

var valuedEvents= ["error", "value", "openobject", "key"]

function ClarinetStream(){
	if(!(this instanceof ClarinetStream)){
		return new ClarinetStream()
	}
	stream.Transform.call(this)

	this.parser= clarinet.parser()
	this.outFn= null

	for(var i in clarinet.EVENTS){
		var ev= clarinet.EVENTS[i],
		  hasValue= valuedEvents.indexOf(ev) != -1
		this.parser["on"+ev]= hasValue? function(i,a){this.outFn([i,a])}.bind(this,i): function(i){this.outFn([i])}.bind(this,i)
	}
	return this
}
util.inherits(ClarinetStream, stream.Transform)
ClarinetStream.prototype._transform= _transform

function _transform(chunk, outFn, callback){
	if(chunk instanceof buffer)
		chunk= chunk.toString()
	this.outFn= outFn
	this.parser.write(chunk)
	callback()
}

module.exports= ClarinetStream
