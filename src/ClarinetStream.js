var buffer= require("buffer").Buffer,
  stream= require("stream"),
  util= require("util"),
  clarinet= require("clarinet")

var valuedEvents= ["error", "value", "openobject", "key"]

function ClarinetStream(){
	if(!(this instanceof ClarinetStream)){
		return new ClarinetStream()
	}
	stream.Transform.call(this,{objectMode:true})

	this.parser= clarinet.parser()

	for(var i in clarinet.EVENTS){
		var ev= clarinet.EVENTS[i],
		  hasValue= valuedEvents.indexOf(ev) != -1
		this.parser["on"+ev]= hasValue? function(i,a){this.push([i,a])}.bind(this,i): function(i){this.push([i])}.bind(this,i)
	}
	return this
}
util.inherits(ClarinetStream, stream.Transform)
ClarinetStream.prototype._transform= _transform

function _transform(chunk, encoding, callback){
	if(chunk instanceof buffer)
		chunk= chunk.toString()
	this.parser.write(chunk)
	callback()
}

module.exports= ClarinetStream
