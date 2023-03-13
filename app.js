require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const ejs = require("ejs");
const mongoose = require("mongoose");
//const md5 = require("md5");
//(now below where we required mongoose we will require our modules )
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
//after getting our client secret id and password we now require our google strategy 
const GoogleStrategy = require('passport-google-oauth20').Strategy;
//now below where we serialized and deserialized our user we now set up our STRATEGY 

//for this below findOrCreate function to work we need to install a package name 
// npm install mongoose-findorcreate and require it
const findOrCreate = require('mongoose-findorcreate');

//because we are using hashing we need to remove this mongoose encryption and also the plugin below -refer to the steps file 
//const encrypt = require("mongoose-encryption");

const { env } = require('process');


const app = express();


app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
    extended: true
}));



//now we use session write this code just above mongoose.connect method and 
//below the all of the other app.uses
//(we write another app.use with some paranthesis )
app.use(session({

       secret: "Our little secret.",
       resave: false,
       saveUninitialized: false
                }));
//now just below this app.use we write other app.use for our passport
app.use(passport.initialize());
app.use(passport.session());



// connecting to our database via mongoose connection link 
const mongoDB= "mongodb://127.0.0.1:27017/userDB";
//using . connect method of mongoose
mongoose.connect(mongoDB,{useNewUrlParser:true},
    (err)=>{if(err){console.log("Mongodb not connected");}
            else{console.log("mongoDB is connected");}
           }
            )
         

// creating schema 
const userSchema = new mongoose.Schema({
    email: String,
    password: String,
    //here we are adding a feild called googleId to store the google id of the user returned by the google signup method 
    googleId: String,
    //we add in another feild for submiting new data 
    secret:String
});

//(NOW after our schema we add a plugin) remember for plugin to work it has to be a schema
userSchema.plugin(passportLocalMongoose);
//we also have to add plugin to the schema for our find or create package 
userSchema.plugin(findOrCreate);

//below this schema we can pass in our custom made encryption key 
//const secret = "Thisismycustomsecretkey";
//but we are now pasting this secret key into the .env file 
//as a part of raising security IN THIS FORMAT->SECRET=Thisismycustomsecretkey



//remember it has to be done before creating the model
//case is password and if we need to specify multiple elements we can do it by adding comma and element
//userSchema.plugin(encrypt,{secret:process.env.SECRET, encryptedFields:["password"]});

//because we are using hashing we need to remove this mongoose encryption and also the plugin above -refer to the steps file



// creating model based on the above schema
const User = new mongoose.model("User",userSchema);
//(NOW RIGHT BELOW WHERE WE HAVE CREATED OUR MODEL )
passport.use(User.createStrategy());


//we replace these below two lines with our passport's serializing and deserializing method so that it works with every strategy
//passport.serializeUser(User.serializeUser());
//passport.deserializeUser(User.deserializeUser());


// used to serialize the user for the session
passport.serializeUser(function(user, done) {
    done(null, user.id); 
});

// used to deserialize the user
passport.deserializeUser(function(id, done) {
    User.findById(id, function(err, user) {
        done(err, user);
    });
});
//now below where we serialized and deserialized our user we now set up our STRATEGY 

passport.use(new GoogleStrategy({
    clientID:     process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    //here we change the callback url to the same that we set on our google api i.e the redirection url
    callbackURL: "http://localhost:3000/auth/google/secrets",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
    passReqToCallback   : true
  },
  function(request, accessToken, refreshToken, profile, done) {
//we are logging the profile info that has been returned by google at the time of google signup
console.log(profile);

    //for this below findOrCreate function to work we need to install a package name  npm install mongoose-findorcreate and require it 
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return done(err, user);
    });
  }
));

//till here pasted from docs



//Note- the point which we require to create user is when it is done at registration page 
 


app.get("/", function(req, res){
    res.render("home");
});

app.get("/login", function(req, res){
    res.render("login");
});


app.get("/register", function(req, res){
    res.render("register");
});

app.get("/secrets", function(req,res){
   User.find({ "secret" : {$ne: null}}, function(err, foundUsers){
    if(err){console.log(err);}
    if(foundUsers){res.render("secrets", {usersWithSecrets: foundUsers});}
   });
});

app.get("/submit", function(req,res){
    if(req.isAuthenticated()){
        res.render("submit");
    }else {
        res.redirect("/login");
    }
});

//we also define a post method for our user to post in new data 
app.post("/submit", function(req,res){
    const submittedSecret = req.body.secret;

    console.log(req.user.id);

    User.findById(req.user.id, function(err, foundUser){
        if(err){console.log(err);}
        else{
            if(foundUser){foundUser.secret = submittedSecret;
            foundUser.save(function(){res.redirect("/secrets");});
            }
        }
    });
});


//now we add on get route for registration with google 
app.get("/auth/google", 

    //here we use passport to authenticate the user via google strategy and we also define the scope which here will be profile
    passport.authenticate("google", {scope:["profile"] }) 


);

//now we also need to define redirection route after being authenticated by the user 
//here we are locally authenticating the user and returning the user to our desired page as a response of successful authentication 
app.get( "/auth/google/secrets",
    passport.authenticate( 'google', {
        successRedirect: "/secrets",
        failureRedirect: "/login"
}));


//remember inside our logout route we are now going to deAuthenticate our user and end our session 
app.get("/logout", function(req,res){
    req.logOut(function(err){
        if(err){console.log(err);}
        else{res.redirect("/");}
    });
    
      
});


app.post("/register", function(req,res){

//Now in we define the post routes again 
//firstly we tap into our model that we created and call register method 
//inside which we will firstly add username feild 
//and initialize it with what user entered that comes from req.body.username ,
//then we pass in the password which user entered ,
//then we add in a callback function 
//which potentially gives us an error if any or with the new registered user 

 User.register({username: req.body.username}, req.body.password, function(err, user){
       if(err){
               console.log(err);
                res.redirect("/register");
              }else{
        //we authenticate user with password 
                   passport.authenticate("local")(req,res, function(){
                                                             res.redirect("/secrets");
                                                                   });

                                                                }

                                                            });

    //we now are  using cookie method so we will comment it all out
    /*from here 
    const newUser = new User({
        email: req.body.username,
        password: md5(req.body.password)
    });

    newUser.save(function(err){
        if(err){console.log(err);}
        else{res.render("secrets");}
    }); 
    till here */
});


app.post("/login", function(req,res){

//now we define the post routes for our login as well 
 
const user = new User({
    username: req.body.username,
    password: req.body.password
    
    });
    
    //now we use passport to login the user and authenticate them 
    //for this we use the login function of passport 
    req.login(user,function(err){
    if(err){console.log(err);}
    else{passport.authenticate("local")(req,res, function(){
    res.redirect("/secrets");
    });
    }
});
    




//we now are  using cookie method so we will comment it all out 

/* from here
  //which will be equal to the credentials entered by the user at the login page 
    const username = req.body.username;
    const password = req.body.password;

    //now we use the mongoose findOne method to authenticate 
// we assigned email as the user name entered and a (function with error and foundUser as the arguments)
//this function checks if err-> log the error else check 
//->if foundUser check foundUser.password=== password and if all true render back the secrets file 

    User.findOne({email : username}, function(err , foundUser){
        if(err){console.log(err);}
        else{
            if(foundUser){
                if(foundUser.password=== password){
                    res.render("secrets");
                }
            }
        }
    });   
    till here*/
});


app.listen(3000, function(){
    console.log("Server is up and running");
});