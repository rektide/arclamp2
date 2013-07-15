var fs= require("fs"),
  clarinetStream= require("../src/ClarinetStream"),
  jsonPath= require("../src/JsonPath")

module.exports= function(test,opts){
	opts= opts|| {}
	var rs= fs.createReadStream("../package.json", {encoding: "utf8"})
	  cs= clarinetStream(),
	  jp= jsonPath()
	jp.expr(test)
	process.nextTick(function(){
		cs.pipe(jp)
		rs.pipe(cs)
	})
	if(opts.postPrint){
		setTimeout(function(){
			console.log("expr is ",expr)
		},1000)
	}
	return jp
}
