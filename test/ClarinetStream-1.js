var fs= require("fs"),
  clarinetStream= require("../src/ClarinetStream")

var fs= fs.createReadStream("../package.json"),
  cs= clarinetStream()

fs.pipe(cs)
cs.on("readable",function(){
	console.log("GOT",cs.read())
})

