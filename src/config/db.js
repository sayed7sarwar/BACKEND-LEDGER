const dns = require('node:dns');
dns.setServers(['8.8.8.8' , '0.0.0.0']);
dns.setDefaultResultOrder('ipv4first')

const mongoose = require("mongoose")


function connectToDB(){

  mongoose.connect(process.env.MONGO_URI)  //process.env.MONGO_URI // This accesses the MongoDB connection string from your environment variables

  .then(()=>{
    console.log("server is connected to DB")
  })
  .catch(err=>{
     console.log("Error connecting to DB")
    process.exit(1)   // if error happens stop the server otherwise it consume our resources.
  })
} 

module.exports = connectToDB