var clarinet= require("clarinet")

module.exports= {}

for(var i in clarinet.EVENTS){
	module.exports[i]= clarinet.EVENTS[i]
	module.exports[clarinet.EVENTS[i]]= i
}
