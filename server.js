require("dotenv").config() // Load environment variables 
                           // .config() reads the .env file from your project.

const app = require("./src/app")
const connectToDB = require("./src/config/db.js") //This imports the function responsible for connecting your application to the database

connectToDB()

app.listen(3000, ()=>{
    console.log("Server is running on port 3000")
})