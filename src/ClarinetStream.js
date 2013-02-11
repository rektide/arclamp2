var stream= require("stream"),
  util= require("util")

function ClarinetStream(){
	if(!(this instanceof ClarinetStream)){
		return new ClarinetStream()
	}
	stream.Transform.call(this)
	return this
}
util.inherits(ClarinetStream, stream.Transform)
ClarinetStream.prototype._transform= _transform

function _transform(chunk, outFn, callback){
	//this.parser.write(chunk)
	callback()
}

module.exports= ClarinetStream
