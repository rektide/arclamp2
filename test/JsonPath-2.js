var fs= require("fs"),
  clarinetStream= require("../src/ClarinetStream"),
  jsonPath= require("../src/JsonPath")

var fs= fs.createReadStream("../package.json", {encoding: "utf8"}),
  cs= clarinetStream(),
  jp= jsonPath()

//cs.on("readable",function(){
//	console.log("CS",cs.read())
//})
jp.on("readable",function(){
	console.log("JP",jp.read())
})


var expr= jp.expr("$.dependencies.clarinet")


cs.pipe(jp)
fs.pipe(cs)

setTimeout(function(){
	//console.log("expr is ",expr)
},1000)

