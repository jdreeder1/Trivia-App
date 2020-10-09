const dotenv = require('dotenv');
dotenv.config();

const path = require('path')
const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const Datastore = require('nedb') 
const nodemailer = require('nodemailer')

const app = express();
app.use(cors());
//to use json
app.use(bodyParser.json());
//to use url encoded values. 
//if set extended to false, allows accessing req.body to get posted formdata
app.use(bodyParser.urlencoded({
    extended: false
}));

const rootPath = `C:/xampp/htdocs/Trivia/src`;
let emailData = {};

app.get('/', (req, res) => {
    //let p = path.join(__dirname, 'src/client/index.html');
    //res.sendFile('C:/xampp/htdocs/Trivia/src/client/views/create_questions.html');
    res.sendFile('/client/views/login.html', { root: rootPath});
    console.log(rootPath);
});

app.get('/create_teams', (req, res) => {
    //let p = path.join(__dirname, 'src/client/index.html');
    //res.sendFile{ root: __dirname }
    res.sendFile(`${rootPath}/client/views/create_teams.html`);
});


const questionDatabase = new Datastore('questionDB.db');
const teamDatabase = new Datastore('teamDB.db');
const loginDatabase = new Datastore('loginDB.db');
const createUserDatabase = new Datastore('newUserDB.db');

//loads existing db. if one doesn't exist, creates db
questionDatabase.loadDatabase();
teamDatabase.loadDatabase();
loginDatabase.loadDatabase();
createUserDatabase.loadDatabase();

//ensures user inputs unique email address
createUserDatabase.ensureIndex({ fieldName: 'email', unique: true });

const port = Number(process.env.PORT || 3330);
// designates what port the app will listen to for incoming requests
app.listen(port, ()=>{
    console.log(`Server running on port ${port}!`);
    console.log('Email port: ', process.env.EMAIL_PORT);
}); 

//USE BCRYPT TO HASH AND UNHASH PASSWORDS!
//npm i bcrypt

app.post('/post_qs', (req, res) => {
    const data = req.body;
    questionDatabase.insert(
        {q1: data.q1, correct1: data.correct1, option1: data.option1, option2: data.option2, option3: data.option3, option4: data.option4}
    );
    res.json({
        status: 'success',
        info: data
    });
});

app.post('/post_team', (req, res) => {
    const data = req.body;

    let teamData = {teamName: data.teamName, captain: data.captain};

    //make sure team created isn't already in DB, make sure captain email isn't assigned to 2 diff teams
    teamDatabase.ensureIndex({fieldName: 'teamName', unique: true});

    teamDatabase.findOne({teamName: data.teamName}, (err, doc) => {
        if(err){
            res.send('Error:', err);
        }
        else if(doc == null){
            teamDatabase.insert(teamData); 
        }
        else {
            res.send('Team already exists. Please pick a different team name!');
        }
    });
        
/*
    teamDatabase.findOne({teamName: data.teamName}, (err, doc) => {
        if(err){
            res.send('Error:', err);
        }
        else {
            teamDatabase.insert(teamData);
            res.json({
                status: 'success',
                info: data
            });
        }
    });
    */

});

app.post('/signin', (req, res) => {
    const data = req.body;
    //check for captain email first
    teamDatabase.findOne({captain: data.email}, (err, doc) => {
        if(err){
            res.send('Error:', err);
        }
        //if not a captain, check if player
        else if(doc == null){
            createUserDatabase.findOne({email: data.email}, (err, doc) => {
                if(err){
                    res.send('Error:', err);
                }
                else if(doc == null){
                    res.send('Email doesn\'t match. Try again!');
                }
                //if email matches a player, verify pw matches that player's pw
                else{
                    let matchingEmailDoc = doc;
                    createUserDatabase.findOne({_id: data.pw}, (err, doc) => {
                        if(err){
                            res.send('Error:', err);
                        }
                        //if pw doesn't match
                        else if(doc == null){
                            res.send('Password doesn\'t match. Try again!');
                        }
                        else if(matchingEmailDoc.email == doc.email) {
                            res.send('Thanks for joining, player!');
                            loginDatabase.insert(
                                {email: data.email, pw: data.pw, theme: data.theme}
                            );                            
                        }
                        else {
                            res.send('Password doesn\'t match. Try again!');    
                        }
                    });
                }

            });
        }
        //email matches captain, verify pw matches that player's pw
        else { 
            let matchingEmailDoc = doc;
            console.log(matchingEmailDoc);
            createUserDatabase.findOne({_id: data.pw}, (err, doc) => {
                if(err){
                    res.send('Error:', err);
                }
                //if pw not found
                else if(doc == null){
                    res.send('Password doesn\'t match. Try again!');
                }
                //verify pw entered matches captain's pw in newuserdb
                else if(matchingEmailDoc.captain == doc.email) {
                    res.send('Thanks for joining, captain!');
                    loginDatabase.insert(
                        {email: data.email, pw: data.pw, theme: data.theme}
                    );                            
                }
                //if pw doesn't match                
                else {
                    res.send('Password doesn\'t match. Try again!');    
                }
            
            });
        }
    });    
    /*
    //see if login matches, if not, throw error
    createUserDatabase.findOne({_id: data.pw}, (err, doc) => {
        if(err){
            res.send('Error:', err);
        }
        //if pw doesn't match
        else if(doc == null){
            res.send('Password doesn\'t match. Try again!');
        }
        else {
            console.log(doc.email);
            teamDatabase.findOne({captain: data.email}, (err, doc)  => {
                if(err){
                    res.send('Error:', err);
                }
                //if email doesn't match captain, make sure email matches player
                else if(doc == null){
                    createUserDatabase.findOne({email: data.email}, (err, doc) => {
                        if(err){
                            res.send('Error:', err);
                        }
                        else if(doc == null){
                            res.send('Email doesn\'t match. Try again!');
                        }
                        else { // **BUG** pw and email need to belong to the same player!
                            res.send('Thanks for joining, player!');
                            loginDatabase.insert(
                                {email: data.email, pw: data.pw, theme: data.theme}
                            );
                        }
                    });                    
                }
                else {
                    res.send('Thanks for joining, captain!');
                    loginDatabase.insert(
                        {email: data.email, pw: data.pw, theme: data.theme}
                    );
                }
            });               
        }
        */
   

    
//{email: data.email, team: data.pw}

});

app.post('/validate', (req, res) => {
    let data = req.body;
    let home = req.body.homepage;
    let d = new Date();
    let currDate = d.toDateString();
    let currentDate = d.toLocaleTimeString();
    let newDate = `${currDate} ${currentDate}`;
    let index = 0;

    emailData = {firstName: data.firstName, lastName: data.lastName, team: data.team, email: data.email, timeStamp: newDate};
    //req.body;
    createUserDatabase.insert(
        //{firstName: data.firstName, lastName: data.lastName, email: data.email}
        emailData
    );

     let transport = nodemailer.createTransport({
        host: process.env.EMAIL_SERVER,
        port: process.env.EMAIL_PORT,
        auth: {
          user: process.env.USER,
          pass: process.env.PASSWORD
        }
     })

    const message = {
        from: 'woodystrivia@yahoo.com', // Sender address
        to: 'woodystrivia@yahoo.com',         // List of recipients
        subject: 'New Trivia Account Request', // Subject line
        text: 'A new user would like to join Woody\'s Trivia.' // Plain text body
    };
    transport.sendMail(message, (err, info) => {
        if (err) {
          console.log(err)
        } else {
          console.log(info);
        }

        console.log("Message sent: %s", info.messageId);

    });

   /*res.json({
    status: 'success',
    info: req.body
   });*/
    //res.sendFile(`${rootPath}/client/views/validate.html`);
    
    res.send(`<p>Your request to create an account is being reviewed. You will receive an email from us shortly.</p><br>
    <a href='/'><button>Home</button></a>
    `);
    
    console.log(home);
});
