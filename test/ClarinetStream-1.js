var fs= require("fs"),
  clarinetStream= require("../src/ClarinetStream")

var fs= fs.createReadStream("../package.json", {encoding: "utf8"}),
  cs= clarinetStream()

cs.on("readable",function(){
	console.log("GOT",clarinetStream.read())
})

fs.pipe(cs)
