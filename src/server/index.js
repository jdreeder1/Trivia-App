const dotenv = require('dotenv');
dotenv.config();

const path = require('path')
const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const nodemailer = require('nodemailer')
const {MongoClient} = require('mongodb') //use to connect to mongo cluster
const ejs = require('ejs')
const session = require('express-session')
const flash = require('express-flash')
const socket = require('socket.io')
//const passport = require('passport')

//const initializePassport = require('./passport-config')
//initializePassport(passport, email => {})

let questionData = {};

const app = express();
app.use(cors());
//to use json
app.use(bodyParser.json());
//to use url encoded values. 
//if set extended to false, allows accessing req.body to get posted formdata
app.use(bodyParser.urlencoded({
    extended: false
}));
app.use(session({
    secret: 'secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 43200000 }
}));

app.use(flash());

app.set('view engine', 'ejs');

//push teams into trivia answers, each team has team members, when all team members have answered, give option to go to next question, 
//only team captain's answer is pushed to the database
let hideNextButton = false;
//let user = '';
//let triviaTeam = '';
let questionDataClone;

//HAVING GLOBAL VARIABLES ON SERVER COULD CAUSE ISSUES IF MULTIPLE TEAMS USE THE SAME PORT or multiple users share the same device!!!

//tells express where to look for stylesheets
//app.use(express.static('/src/client'));
app.use(express.static( "public" ));

app.get('/', (req, res) => {
    //let p = path.join(__dirname, 'src/client/index.html');
    //res.sendFile('C:/xampp/htdocs/Trivia/src/client/views/create_questions.html');
    //res.sendFile('/client/views/login.html', { root: rootPath});
    res.render('login');
    //console.log(rootPath);
});

const port = Number(process.env.PORT || 3330);
// designates what port the app will listen to for incoming requests
const server = app.listen(port, ()=>{
    console.log(`Server running on port ${port}!`);
    console.log('Email port: ', process.env.EMAIL_PORT);
}); 

//socket setup
const io = socket(server);

//socket var refers to instance of socket, i.e., connection between new browser and server
io.on('connection', (socket) => {
    //const userId = await fetchUserId(socket);
    socket.on('joinChat', (data) => {
        socket.join(data.team);
        console.log(`Joined ${data.team} chat`);
        io.in(data.team).emit('joinChat', data);    
    });

    let chatData = {};
    //listen to msg from client and send out to all clients connected to same port
    socket.on('chat', (data) => {
        //io.sockets.emit('chat', data);
        chatData = data;
        io.in(data.team).emit('chat', data);
    });

    //if socket room name exists, join, else create room

});

const listDatabases = async (client) => {
    databasesList = await client.db().admin().listDatabases();
 
    console.log("Databases:");
    databasesList.databases.forEach(db => console.log(` - ${db.name}`));
};

let main  = async () => {
    //Replace <password> with the password for the jdreeder1 user. Replace <dbname> with the name of the database that connections will use by default. Ensure any option params are URL encoded.
    const client = new MongoClient(process.env.MONGO_CONNECT, {useUnifiedTopology: true });
    
    try {
        // Connect to the MongoDB cluster
        await client.connect();
        // Make the appropriate DB calls
        await listDatabases(client);
    }
    catch (e) {
        console.error(e);
    } 
    
    finally {
        await client.close();
    }
    
}; 
main().catch(console.error);

//create new document
const createListing = async (client, collection, newListing) => {
    const result = await client.db("woodys_trivia").collection(collection).insertOne(newListing);
    console.log(`New listing created with the following id: ${result.insertedId}`);
};
//read/find one document
const findOneListingByName = async (client, collection, nameOfListing) => {
    let result = await client.db("woodys_trivia").collection(collection)
                        .findOne({ teamName: nameOfListing });

    if (result) {
        console.log(`Found a listing in the collection with the name '${nameOfListing}':`);
        console.log(result);
        return true;
    } else {
        console.log(`No listings found with the name '${nameOfListing}'`);
        return false;
    }
};

const findUserLogin = async (client, collection, userLogin) => {
    let responseObj = {}
    let captainResult = await client.db("woodys_trivia").collection(collection)
                        .findOne({captain: userLogin.email});   
                        
    if(captainResult){
        console.log(captainResult.captain);
        //verify pw
        try {

            let passwordMatch = await client.db("woodys_trivia").collection("newUser")
                        .findOne({password: userLogin.pw});

            if(passwordMatch && passwordMatch.email == captainResult.captain){
                console.log("Welcome to trivia, captain!");
                responseObj.captain = true;
                responseObj.name = `${passwordMatch.firstName} ${passwordMatch.lastName}`;
                responseObj.team = `${passwordMatch.team}`;
                responseObj.email = `${passwordMatch.email}`;
                return responseObj;
            }    
            else {
                responseObj.err = "Incorrect password, try again!";
                return responseObj;
            } 
        }
        catch (e) {
            console.error(e);
        }
           
    }                            
    else { 
        //check player collection for matching email
        
        let playerResult = await client.db("woodys_trivia").collection("newUser")
                        .findOne({email: userLogin.email});
        //if email matches a player, verify pw matches that player's pw
        if(playerResult && playerResult.password == userLogin.pw){
                responseObj.player = true;
                responseObj.name = `${playerResult.firstName} ${playerResult.lastName}`;
                responseObj.team = `${playerResult.team}`;
                responseObj.email = `${playerResult.email}`;
                return responseObj;
            }
        else if(playerResult && playerResult.password !== userLogin.pw){
            responseObj.err = 'Error: Invalid password entered. Please try again.';
            return responseObj;
        }
        else {
            responseObj.err = 'Error: Invalid email entered. Please try again.';
            return responseObj;
        }
    }

};

const findStartTime = async(client) => {
    let result = await client.db("woodys_trivia").collection("questions")
                    .findOne(
                        {"event": "trivia"}
                    );
        if (result) {
            //console.log(`Found a listing in the collection with the name '${nameOfListing}':`);
            //console.log(result);
            return result;
        } else {
            console.log(`No listings found!'`);
            return false;
        } 
}

const logoutUser = async(client, team, email) => {
    let result = await client.db("woodys_trivia").collection("teams")
    //db.getCollection('docs').update({ },{'$pull':{ 'items':{'id': 3 }}},{multi:true})
                    .updateOne(
                        {teamName: team},
                        { '$pull': { 'loggedInUsers': {'email': email} }} 
                    ); 
        if(result){
            return true;     
        }
        else {
            return false;
        }
};

const findAdminLogin = async (client, collection, adminLogin) => {
    let result = await client.db("woodys_trivia").collection(collection)
                        .findOne({
                            adminUsername: adminLogin.adminUsername,
                            admin_pw: adminLogin.admin_pw,
                            secretWord: adminLogin.secretWord
                        });
                        //adminUsername: data.adminUsername, admin_pw: data.admin_pw, secretWord: data.secretWord
    if (result) {
        console.log(`Admin info found!`);
        console.log(result);
        return true;
    } else {
        console.log(`No admins found with that login info!`);
        return false;
    }
};
const findQuestions = async (client) => {
    let cursor = await client.db("woodys_trivia").collection("questions")
                        .find({});

    const results = await cursor.toArray();

    return results;

};

const findOneQuestion = async (client, question) => {
    let result = await client.db("woodys_trivia").collection("questions")
                        .findOne({ question: question });

    if (result) {
        //console.log(`Found a listing in the collection with the name '${nameOfListing}':`);
        //console.log(result);
        return result;
    } else {
        console.log(`No listings found!'`);
        return false;
    }
};

const updateStartTime = async(client, dt, time) => {
    let result = await client.db("woodys_trivia").collection("questions")
                    .updateOne(
                        {event: 'trivia'},
                        {$set: {startDate: dt, startTime: time}},
                        {upsert: true}
                    );

    console.log(`${result.matchedCount} document(s) matched the query criteria. Start time updated.`);     

};

const updateAllListingsToHavePropertyType = async(client, q_number, q_data) => {

    let result = await client.db("woodys_trivia").collection("questions")
                    .updateOne(
                            {question: q_number},
                            {$set: 
                                {q: q_data.q, correct: q_data.correct, option1: q_data.option1, option2: q_data.option2, option3: q_data.option3, option4: q_data.option4}
                            },
                            {upsert: true}
                        );

        console.log(`${result.matchedCount} document(s) matched the query criteria.`);     
};

const findTeamInfo = async(client, team) => {
    let result = await client.db("woodys_trivia").collection("teams")
                        .findOne({ teamName: team });

    if (result) {
        //console.log(`Found a listing in the collection with the name '${nameOfListing}':`);
        //console.log(result);
        return result;
    } else {
        console.log(`No listings found!'`);
        return false;
    }    
};

const submitFinalBet = async(client, team, bet) => {
    let result = await client.db("woodys_trivia").collection("teams")
                    .updateOne(
                        {teamName: team},
                        { $set: {finalBet: bet}},
                        {upsert: true}
                    );

        console.log(`${result.matchedCount} document(s) matched the query criteria. Final bet sumbitted.`);     

};
/*
const findLoggedInUser = (client, team, user) => {
    let result = await client.db("woodys_trivia").collection("teams")
                    .findOne(
                        {teamName: team, "loggedInUsers.email": user}
                    );
        if(result){
            return result;
        }
        else {
            console.log(`No result found!`);
        }
};
*/
const addLoggedInUser = async(client, team, user) => {
    let result = await client.db("woodys_trivia").collection("teams")
                    .updateOne(
                        {teamName: team},
                        {$push: { loggedInUsers: user }}   
                    );
        if(result){
            return true;     
        }
        else {
            return false;
        }
};

const updateLoggedInUser = async(client, team, userObj) => {
    let result = await client.db("woodys_trivia").collection("teams")
                    .find(
                        {"loggedInUsers.email": userObj.email}
                    );
    if (result) {
        const results = await result.toArray();
        return results;
    }
    else {
        return false;
        /*
        let update = await addLoggedInUser(client, team, userObj);
        if(update){
            console.log(`Log in successful!`);
            return true;
        }
        else {
            console.log(`Log in unsuccessful!`);
        }
        */
    }

};

const findTeamAnswer = async(client, team, q_num) => {
    let result = await client.db("woodys_trivia").collection("teams")
                    .find(
                        { $and: [ { teamName: { team } }, { "answers.question": { q_num } } ] } 
                    );
    if(result){
        const results = await result.toArray();
        //return results;
        console.log(results);
    }
    else {
        return false;
    }        
};

const updateTeamAnswer = async(client, team, guess, q_num) => {
    let answerObj = {
        question: q_num,
        guess: guess
    };
        let result = await client.db("woodys_trivia").collection("teams")
                    .updateOne(
                        {teamName: team},
                        {$push: { answers: answerObj }}
                    );
        console.log(`${result.matchedCount} document(s) matched the query criteria. Answer updated.`); 

        
};

//NEED TO UPDATE ANSWER FIELD FOR CORRECT QUESTION!
const updateTeamScore = async(client, team, guess, q_num, num_points) => {
    let result = await client.db("woodys_trivia").collection("teams")
                    .updateOne(
                        {teamName: team}, 
                        {$set:
                            {runningTotal : num_points, lastQuestionAnswered: q_num}
                        },
                        {upsert: true}
                    );
        if(result){                    
            console.log(`${result.matchedCount} document(s) matched the query criteria. Score updated.`);
        }
        else{
            console.log('Error - could not update team score.');
        }
        
        //await findTeamAnswer (client, team, q_num);
        
        //await updateTeamAnswer(client, team, guess, q_num);
};

const getAllTeamScores = async(client) => {
    let result = await client.db("woodys_trivia").collection("teams")
                    .find({});
    if(result){
        const results = await result.toArray();
        return results;
    }
    else {
        console.log('Error - couldn\'t find teams!');
    }

};

//instead of posting team answer for each question, pull correct answer from server endpoint and compare with answer team provided, then 
//update score accordingly

app.post('/post_qs', async (req, res) => {
    let data = req.body;
    /*
    let timeArr = data.start_date.split('T');
    let dt = timeArr[0].toString().split('-');
    let time = timeArr[1];
    console.log(`Date: ${dt}, Time: ${time}`);

    let yr = Number(dt[0]);
    let mo = Number(dt[1]);
    let day = Number(dt[2]);
    let newDt = `${yr}-${mo}-${day}`;
    
    let timeStart = '19:00';
    */
    //let newDt = `${data.start_date}T${data.start_time}`
    //new Date( Date.parse('2012-01-26T13:51:50.417-07:00') )
    let newDt = new Date(Date.parse(`${data.start_date}`));
    
    console.log(newDt);
    //let stDt = newDate.toDateString();
/*
    let date = new Date();
    //let today = dt.toDateString();

    if(date<newDate){
    console.log('too early! log in later!');
    }
    else {
    console.log('you can login now!');
    }
*/

    /*let d = new Date();
    let currDate = d.toDateString();
    let currentDate = d.toLocaleTimeString();*/

    let question1 = {q: data.q1, correct: data.correct1, option1: data.option1_q1, option2: data.option2_q1, option3: data.option3_q1, option4: data.option4_q1};
    let question2 = {q: data.q2, correct: data.correct2, option1: data.option1_q2, option2: data.option2_q2, option3: data.option3_q2, option4: data.option4_q2};
    let question3 = {q: data.q3, correct: data.correct3, option1: data.option1_q3, option2: data.option2_q3, option3: data.option3_q3, option4: data.option4_q3};
    let question4 = {q: data.q4, correct: data.correct4, option1: data.option1_q4, option2: data.option2_q4, option3: data.option3_q4, option4: data.option4_q4};
    let question5 = {q: data.q5, correct: data.correct5, option1: data.option1_q5, option2: data.option2_q5, option3: data.option3_q5, option4: data.option4_q5};
    let question6 = {q: data.q6, correct: data.correct6, option1: data.option1_q6, option2: data.option2_q6, option3: data.option3_q6, option4: data.option4_q6};
    let question7 = {q: data.q7, correct: data.correct7, option1: data.option1_q7, option2: data.option2_q7, option3: data.option3_q7, option4: data.option4_q7};
    let question8 = {q: data.q8, correct: data.correct8, option1: data.option1_q8, option2: data.option2_q8, option3: data.option3_q8, option4: data.option4_q8};
    let question9 = {q: data.q9, correct: data.correct9, option1: data.option1_q9, option2: data.option2_q9, option3: data.option3_q9, option4: data.option4_q9};
    let question10 = {q: data.q10, correct: data.correct10, option1: data.option1_q10, option2: data.option2_q10, option3: data.option3_q10, option4: data.option4_q10};

    let question11 = {q: data.q11, correct: data.correct11, option1: data.option1_q11, option2: data.option2_q11, option3: data.option3_q11, option4: data.option4_q11};
    let question12 = {q: data.q12, correct: data.correct12, option1: data.option1_q12, option2: data.option2_q12, option3: data.option3_q12, option4: data.option4_q12};
    let question13 = {q: data.q13, correct: data.correct13, option1: data.option1_q13, option2: data.option2_q13, option3: data.option3_q13, option4: data.option4_q13};
    let question14 = {q: data.q14, correct: data.correct14, option1: data.option1_q14, option2: data.option2_q14, option3: data.option3_q14, option4: data.option4_q14};
    let question15 = {q: data.q15, correct: data.correct15, option1: data.option1_q15, option2: data.option2_q15, option3: data.option3_q15, option4: data.option4_q15};
    let question16 = {q: data.q16, correct: data.correct16, option1: data.option1_q16, option2: data.option2_q16, option3: data.option3_q16, option4: data.option4_q16};
    let question17 = {q: data.q17, correct: data.correct17, option1: data.option1_q17, option2: data.option2_q17, option3: data.option3_q17, option4: data.option4_q17};
    let question18 = {q: data.q18, correct: data.correct18, option1: data.option1_q18, option2: data.option2_q18, option3: data.option3_q18, option4: data.option4_q18};
    let question19 = {q: data.q19, correct: data.correct19, option1: data.option1_q19, option2: data.option2_q19, option3: data.option3_q19, option4: data.option4_q19};
    let question20 = {q: data.q20, correct: data.correct20, option1: data.option1_q20, option2: data.option2_q20, option3: data.option3_q20, option4: data.option4_q20};

    let question21 = {q: data.q21, correct: data.correct21, option1: data.option1_q21, option2: data.option2_q21, option3: data.option3_q21, option4: data.option4_q21};
    let question22 = {q: data.q22, correct: data.correct22, option1: data.option1_q22, option2: data.option2_q22, option3: data.option3_q22, option4: data.option4_q22};
    let question23 = {q: data.q23, correct: data.correct23, option1: data.option1_q23, option2: data.option2_q23, option3: data.option3_q23, option4: data.option4_q23};
    let question24 = {q: data.q24, correct: data.correct24, option1: data.option1_q24, option2: data.option2_q24, option3: data.option3_q24, option4: data.option4_q24};
    let question25 = {q: data.q25, correct: data.correct25, option1: data.option1_q25, option2: data.option2_q25, option3: data.option3_q25, option4: data.option4_q25};

    const client = new MongoClient(process.env.MONGO_CONNECT, {useUnifiedTopology: true });

    try {
        // Connect to the MongoDB cluster
        await client.connect();
        await updateStartTime(client, data.start_date, data.start_time)
        .then(
        await updateAllListingsToHavePropertyType(client, 'q1', question1)
        )
        .then(
            await updateAllListingsToHavePropertyType(client, 'q2', question2)
        )
        .then(
            await updateAllListingsToHavePropertyType(client, 'q3', question3)
        )
        .then(
            await updateAllListingsToHavePropertyType(client, 'q4', question4)
        )
        .then(
            await updateAllListingsToHavePropertyType(client, 'q5', question5)
        )
        .then(
            await updateAllListingsToHavePropertyType(client, 'q6', question6)
        )
        .then(
            await updateAllListingsToHavePropertyType(client, 'q7', question7)
        )
        .then(
            await updateAllListingsToHavePropertyType(client, 'q8', question8)
        )
        .then(
            await updateAllListingsToHavePropertyType(client, 'q9', question9)
        )
        .then(
            await updateAllListingsToHavePropertyType(client, 'q10', question10)
        )
        .then(
            await updateAllListingsToHavePropertyType(client, 'q11', question11)
        )
        .then(
            await updateAllListingsToHavePropertyType(client, 'q12', question12)
        )
        .then(
            await updateAllListingsToHavePropertyType(client, 'q13', question13)
        )
        .then(
            await updateAllListingsToHavePropertyType(client, 'q14', question14)
        )
        .then(
            await updateAllListingsToHavePropertyType(client, 'q15', question15)
        )
        .then(
            await updateAllListingsToHavePropertyType(client, 'q16', question16)
        )
        .then(
            await updateAllListingsToHavePropertyType(client, 'q17', question17)
        )
        .then(
            await updateAllListingsToHavePropertyType(client, 'q18', question18)
        )
        .then(
            await updateAllListingsToHavePropertyType(client, 'q19', question19)
        )
        .then(
            await updateAllListingsToHavePropertyType(client, 'q20', question20)
        )
        .then(
            await updateAllListingsToHavePropertyType(client, 'q21', question21)
        )
        .then(
            await updateAllListingsToHavePropertyType(client, 'q22', question22)
        )
        .then(
            await updateAllListingsToHavePropertyType(client, 'q23', question23)
        )
        .then(
            await updateAllListingsToHavePropertyType(client, 'q24', question24)
        )
        .then(
            await updateAllListingsToHavePropertyType(client, 'q25', question25)
        )
        .catch(
            err => console.log(err)
        )
        
    }
    catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
    /*
    questionDatabase.insert(
        {q1: data.q1, correct1: data.correct1, option1: data.option1, option2: data.option2, option3: data.option3, option4: data.option4}
    );  
    
     */
});

app.post('/post_team', async (req, res) => {
    const data = req.body;
    answerArr = [];
    loggedIn = [];

    let teamData = {teamName: data.teamName, captain: data.captain, loggedInUsers: loggedIn, runningTotal: 15, answers: answerArr};

    //make sure team created isn't already in DB, make sure captain email isn't assigned to 2 diff teams
    const client = new MongoClient(process.env.MONGO_CONNECT, {useUnifiedTopology: true });

    //NEED TO LOOK FOR DUPLICATE REQUEST! (i.e., if a user's email has already been used)
    
    try {
        // Connect to the MongoDB cluster
        await client.connect();

        let foundTeam = await findOneListingByName(client, 'teams', teamData.teamName);

        if(foundTeam){
            res.send(`<p>Team already exists! Create a different team!</p><br> <a href='src/client/views/create_team.html'<button>Go Back</button></a>`);
        }
        else {
            await createListing(client, 'teams', teamData);
            res.send(`<p>New team created! Create another team?</p><br> <a href='src/client/views/create_team.html'<button>Create Another Team</button></a>`);
        }
    }

    catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }

});

app.get('/admin_login', async(req, res) => {
    res.render('admin_login');
});

app.post('/admin_signin', async(req, res) => {
    const data = req.body;

    let adminLogin = {adminUsername: data.adminUsername, admin_pw: data.admin_pw, secretWord: data.secretWord};

    const client = new MongoClient(process.env.MONGO_CONNECT, {useUnifiedTopology: true });

    try {
        // Connect to the MongoDB cluster
        await client.connect();

        let foundAdmin = await findAdminLogin(client, 'admin_login', adminLogin);

        if(foundAdmin){
            res.send(`<p>Welcome, admin! Would you like to Create a Team or Create Questions?</p>
            <form method='post' action='/create_team'>
                <button type='submit'>Create Team</button> 
            </form>
            <form method='post' action='/create_questions'>
                <button type='submit'>Create Questions</button>
            </form>`);
        }
        else {
            res.send(`<p>Login info not found! Try again?</p><br> <a href='/admin_login'><button>Admin Login</button></a>`);
        }
    }

    catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
});

app.post('/create_team', (req, res) => {
    res.render('create_team');
});

app.post('/create_questions', (req, res) => {
    res.render('create_questions');
});

app.get('/user_login', (req, res) => {
    res.render('user_signin', { 
        message: req.flash('message')
    });
});

//verified user login
app.post('/signin', async (req, res) => {
    const data = req.body;
    //let start;
    //let strArr;// = start.startDate.split('T');
    //let startDate; //= strArr[0];
    //let startTime; //= start.startTime;
    
    //data.email, data.pw
    if(req.session.logoutStatus == 'alreadyLoggedOut'){
        res.render('error');
    }
    else {

    const client = new MongoClient(process.env.MONGO_CONNECT, {useUnifiedTopology: true });

    try {
        // Connect to the MongoDB cluster
        await client.connect();

        let foundUser = await findUserLogin(client, 'teams', data);
        let start = await findStartTime(client);
      //  strArr = start.startDate.split('T');
        //startDate = strArr[0];
       // startTime = start.startTime;
        //console.log(`Start date: ${new Date(Date.parse(start.startDate))}, Start time: ${start.startTime}`);
        console.log(`${start.startDate}T${start.startTime}:00.00-06:00`);
        req.session.startDate = `${start.startDate}T${start.startTime}:00.00-06:00`;

        if(foundUser.captain){
            //res.redirect('/question1');
           /* userInfo.userType = 'captain';
            userInfo.userName = foundUser.name;
            userInfo.triviaTeam = foundUser.team;*/
            let userObj = {
                userType: 'captain',
                userName: foundUser.name,
                triviaTeam: foundUser.team,
                email: foundUser.email
            };
            
            req.session.userDetails = userObj;

            let loggedIn = await updateLoggedInUser(client, foundUser.team, userObj);
            console.log(loggedIn);

            if(loggedIn.length === 0){
                let addLogin = await addLoggedInUser(client, foundUser.team, userObj);                
                //req.session.userDetails = userObj;
                res.redirect('/find_user');
            }
            else {
                req.session.loginStatus = 'logged in';
                req.flash('login_error', 'You\'re already logged in!');
                req.flash('already_answered', 'You\'ve already answered the previous question!');
                //let backURL=req.header('Referer'); // || '/';
               // if(typeof questionDataClone !== 'undefined' && req.session.questionNum <=questionDataClone.length-1 || typeof questionDataClone == 'undefined' && req.session.questionNum <= 24){
                    res.render('index', {
                        questions: req.session.currentQuestion,
                        typeOfUser: req.session.userDetails.userType,
                        team: req.session.userDetails.triviaTeam,
                        question_num: req.session.questionNum, 
                        login_error: req.flash('login_error'),
                        already_answered: req.flash('already_answered')
                    });
                }/*
                else {
                    res.redirect('/wager');
                }*/            
            //}
            
          //  if(req.session.userDetails.email == foundUser.email){
            //    console.log('Already logged in!');
           /*     req.session.loginStatus = 'logged in';
                req.flash('login_error', 'You\'re already logged in!');
                //let backURL=req.header('Referer'); // || '/';
                res.redirect('/questions');

                //CREATE ANOTHER EJS PAGE THAT RENDERS CURRENT QUESTION AND RE-DIRECT TO THAT IF ALREADY LOGGED IN
            }
            else {
                let addLogin = await addLoggedInUser(client, foundUser.team, userObj);                
                //req.session.userDetails = userObj;
                res.redirect('/find_user');
           }*/
/*
            res.send(`<p id="log">Welcome, ${foundUser.name}! You're a captain for this game! Would you like to start playing trivia? <button onclick="openWin();">Play Trivia</button>
            <script>
            const log = document.getElementById("log");
                function openWin() { 
                    window.open("/questions"); 
                }
                function pause() {
                    log.textContent = "Page timed out!";
                }
                window.addEventListener('blur', pause);
            </script>`);
            */
        }
        else if(foundUser.player){          
        /*    
            userInfo.userType = 'player';
            userInfo.userName = foundUser.name;
            userInfo.triviaTeam = foundUser.team;

            res.redirect('/find_user');
*/
            let userObj = {
                userType: 'player',
                userName: foundUser.name,
                triviaTeam: foundUser.team,
                email: foundUser.email
            };
            await updateLoggedInUser(client, foundUser.team, userObj);

            req.session.userDetails = userObj;
            res.redirect('/find_user');        
/*  
            res.send(`<p>Welcome, ${foundUser.name}!  Would you like to start playing trivia? <button onclick="openWin();">Play Trivia</button>
            <script>
            const log = document.getElementById("log");
                function openWin() { 
                    window.open("/questions"); 
                }
                function pause() {
                    log.textContent = "Page timed out!";
                }
                window.addEventListener('blur', pause);
            </script>`
            );
        */
        }
        else {
            req.flash('message', foundUser.err);
            res.redirect('/user_login');
            //res.send(`${foundUser.err} <a href="/user_login"><button>Try Again</button></a> &nbsp; <a href="/"><button>Home</button></a>`);
        }
    }

    catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

});

app.get('/find_user', async(req, res) => {
    //need to query database to find logged in user
    const userDetails = req.session.userDetails;
    const startDate = req.session.startDate;
    //const userName = req.session.userDetails.userName;
    //const triviaTeam = req.session.userDetails.triviaTeam;

    res.render('found_user', {
         userInfo: userDetails,
         startInfo: startDate
    });
});

app.get('/logout', async(req, res) => {
    console.log(req.session.userDetails.email);
    req.session.logoutStatus = 'alreadyLoggedOut';

    let logOut;

    const client = new MongoClient(process.env.MONGO_CONNECT, {useUnifiedTopology: true });

    try {
        // Connect to the MongoDB cluster
        await client.connect();
        logOut = await logoutUser(client, req.session.userDetails.triviaTeam, req.session.userDetails.email);

        if(logOut){
            req.session.questionData = '';
            res.redirect('/');
        }
    }
    catch (err) {
        console.error(err);
    } finally {
        await client.close();
    }
    
});

app.get('/chat', async(req, res) => {
    res.render('chat-window', {
        userName: req.session.userDetails.userName,
        triviaTeam: req.session.userDetails.triviaTeam 
    });
});

app.post('/questions', async(req, res) => { 

    if(req.session.logoutStatus == 'alreadyLoggedOut'){
        res.send('Error: Can\'t join session after logging out!')
    }
    else {

    const client = new MongoClient(process.env.MONGO_CONNECT, {useUnifiedTopology: true });

    try {
        // Connect to the MongoDB cluster
        await client.connect();
        //let foundQuestion = await findOneQuestion(client, 'q1');
        let foundQuestions = await findQuestions(client);
        try {
            if(!foundQuestions){
                res.sendStatus(404);
            }
            else {
                //res.send(findQuestions);
                req.session.questionData = foundQuestions;
                req.session.finalQuestion = foundQuestions[foundQuestions.length-2];
                questionDataClone = JSON.parse(JSON.stringify(foundQuestions));
                res.redirect('/trivia');
            }
        }
        catch(err){
            res.send(err);
        }
    }

    catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }

}
    //req.session.triviaStatus = req.body.triviaStatus;

});

app.get('/trivia', async(req, res) => {
    //res.send(questionData[0]);  
    //don't need to specify file type ejs b/c already specified ejs as template 
    
    let currentQuestion = req.session.questionData.shift();

    let index = questionDataClone.findIndex((question) => {
        return question.q == currentQuestion.q;
    });

    req.session.questionNum = index+1;
    req.session.currentQuestion = currentQuestion;
    console.log(`Question ${index+1}`);
    if(index+1 <=questionDataClone.length-1){
        res.render('index', {
            questions: req.session.currentQuestion,
            typeOfUser: req.session.userDetails.userType,
            team: req.session.userDetails.triviaTeam,
            question_num: index+1,
            login_error: req.flash('login_error'),
            already_answered: req.flash('already_answered')
        });
    }
    else {
        res.redirect('/wager');
    }
    
});

app.get('/final_question', async(req, res) => {
    //let finalQuestion = req.session.questionData[req.session.questionDataLength];
     //console.log(req.session.finalQuestion);
    
     try {
        res.render('final_question', {
            questions: req.session.finalQuestion,
            typeOfUser: req.session.userDetails.userType,
            team: req.session.userDetails.triviaTeam,
            question_num: questionDataClone.length-1,
            login_error: req.flash('login_error'),
            already_answered: req.flash('already_answered')
        }); 
    }
    catch(err){
        console.log(err);
    } 
});

app.get('/wager', async(req, res) => {
    let teamObj = {};
    let teamNames = [];
    let teamTotals = [];
    let index;

    const client = new MongoClient(process.env.MONGO_CONNECT, {useUnifiedTopology: true });

    try {
        // Connect to the MongoDB cluster
        await client.connect();
        let teamScores = await getAllTeamScores(client);

        if(teamScores){
            for(teams of teamScores){
                //console.log(`${teams.teamName}: ${teams.runningTotal}`);
                teamNames.push(teams.teamName);
                teamTotals.push(teams.runningTotal);
            }
            index = teamNames.findIndex(tm => {
                return tm == req.session.userDetails.triviaTeam; //req.session.userDetails.triviaTeam;
            });
        }
        else {
            console.log(`Couldn't retrieve teams!`);
        }
    }
    catch (err) {
        console.log(err);
    } finally {
        await client.close();
    }

    res.render('final_wager', {
        typeOfUser: req.session.userDetails.userType,
        team: req.session.userDetails.triviaTeam,
        teamScore: teamTotals[index],
        teamNames: teamNames,
        teamTotals: teamTotals,
        question_num: req.session.questionNum,
        login_error: req.flash('login_error')
    });
    
});

app.post('/final_results', async(req, res) => {
    let teamNames = [];
    let teamTotals = [];
    let index;

    const client = new MongoClient(process.env.MONGO_CONNECT, {useUnifiedTopology: true });

    try {
        // Connect to the MongoDB cluster
        await client.connect();
        let teamScores = await getAllTeamScores(client);

        if(teamScores){
            for(teams of teamScores){
                //console.log(`${teams.teamName}: ${teams.runningTotal}`);
                teamNames.push(teams.teamName);
                teamTotals.push(teams.runningTotal);
            }
            index = teamNames.findIndex(tm => {
                return tm == req.session.userDetails.triviaTeam; //req.session.userDetails.triviaTeam;
            });
        }
        else {
            console.log(`Couldn't retrieve teams!`);
        }
    }
    catch (err) {
        console.log(err);
    } finally {
        await client.close();
    }

    res.render('final_results', {
        typeOfUser: req.session.userDetails.userType,
        team: req.session.userDetails.triviaTeam,
        teamScore: teamTotals[index],
        teamNames: teamNames,
        teamTotals: teamTotals,
        login_error: req.flash('login_error')
    });
    
});

app.post('/get_answer', async(req, res) => {

    const guess = req.body.answer;
    const confidence = Number(req.body.confidence); 
    const team_name = req.body.teamName;
    const userType = req.body.userType;
    const question_num = req.body.question_num;
    let outcome = '';
    let total;
    let teamInfo;
    let lastQuestionAnswered;

    const client = new MongoClient(process.env.MONGO_CONNECT, {useUnifiedTopology: true });

    try {
        // Connect to the MongoDB cluster
        await client.connect();
    
        teamInfo = await findTeamInfo(client, team_name);
        try {
            total = teamInfo.runningTotal;
        }
        catch(err){
            console.log(err);
        } 
    }
    catch(err){
        console.log(err);
    } 
    finally {
        await client.close();
    }

    const newClient = new MongoClient(process.env.MONGO_CONNECT, {useUnifiedTopology: true });

    try {
        // Connect to the MongoDB cluster
        await newClient.connect();
        
        console.log(req.session.currentQuestion.correct);

        if(guess == req.session.currentQuestion.correct && userType == 'captain'){
            /*
            for(ans of teamInfo.answers){
                console.log(ans.question, question_num)
                */
                if(teamInfo.lastQuestionAnswered == question_num){
                    console.log('already answered question!');
                    await req.flash('already_answered', 'You\'ve already answered the previous question!');
                    res.redirect('/trivia');
                    //res.end();
                    /*
                    res.render('answer', {
                        correctAnswer: req.session.currentQuestion,
                        guessedAnswer: guess,
                        points: confidence,
                        result: outcome,
                        user: userType,
                        team: team_name,
                        question_num: question_num,
                        already_answered: req.flash('already_answered')
                    });
                    */
                
            }
            else {
                outcome = `Good job! You guessed correctly and gained ${confidence} points!`;
                let newTotal = total + confidence;
                console.log(newTotal);
                let q_num = req.session.questionNum;
                let teamScore = await updateTeamScore(newClient, team_name, guess, q_num, newTotal);

              /*  if(typeof teamInfo.lastQuestionAnswered !== 'undefined'){
                    lastQuestionAnswered = teamInfo.lastQuestionAnswered;
                }*/
                //hideNextButton = false;
                    res.render('answer', {
                        correctAnswer: req.session.currentQuestion.correct,
                        guessedAnswer: guess,
                        points: confidence,
                        result: outcome,
                        user: userType,
                        team: team_name,
                        question_num: question_num,
                        already_answered: req.flash('already_answered')
                    });
                }
            
        }
        else if(guess !== req.session.currentQuestion.correct && userType == 'captain') {
            outcome = `Sorry, you guessed incorrectly. Minus ${confidence} points.`;
            let newTotal = total - confidence;
            console.log(newTotal);
            let q_num = req.session.questionNum;
            console.log(team_name, guess, q_num, newTotal);            
            let teamScore = await updateTeamScore(newClient, team_name, guess, q_num, newTotal);
            res.render('answer', {
                correctAnswer: req.session.currentQuestion.correct,
                guessedAnswer: guess,
                points: confidence,
                result: outcome,
                user: userType,
                team: team_name,
                question_num: question_num,
                already_answered: req.flash('already_answered')
            });
            //hideNextButton = false;
        }
        else {
            outcome = `Waiting on captain's answer.`;
            res.render('answer', {
                correctAnswer: req.session.currentQuestion.correct,
                guessedAnswer: guess,
                points: confidence,
                result: outcome,
                user: userType,
                team: team_name,
                question_num: question_num,
                already_answered: req.flash('already_answered')
            });
            //hideNextButton = true;
        }
    }
    catch(err){
        console.log(err);
    } 
    finally {
        await client.close();
    }

    
    
    //res.redirect('/show_results');
});

app.post('/final_answer', async(req, res) => {
    const guess = req.body.answer;
    const team_name = req.body.teamName;
    const userType = req.body.userType;
    const question_num = req.body.question_num;
    let outcome = '';
    let total;
    let finalBet;
    let teamInfo;

    //let finalQuestion = questionDataClone[questionDataClone.length-1];

    console.log(guess, team_name, userType, question_num);

    const client = new MongoClient(process.env.MONGO_CONNECT, {useUnifiedTopology: true });

    try {
        // Connect to the MongoDB cluster
        await client.connect();
    
        teamInfo = await findTeamInfo(client, team_name);
        try {
            total = teamInfo.runningTotal;
            finalBet = teamInfo.finalBet;
        }
        catch(err){
            console.log(err);
        } 
    }
    catch(err){
        console.log(err);
    } 
    finally {
        await client.close();
    }

    const newClient = new MongoClient(process.env.MONGO_CONNECT, {useUnifiedTopology: true });

    try {
        // Connect to the MongoDB cluster
        await newClient.connect();    

        if(guess == req.session.finalQuestion.correct && userType == 'captain'){
            if(teamInfo.lastQuestionAnswered == question_num){
                console.log('already answered question!');
                req.flash('already_answered', 'You\'ve already answered the previous question!');
                res.render('final_answer', {
                    correctAnswer: req.session.finalQuestion.correct,
                    guessedAnswer: guess,
                    points: finalBet,
                    result: outcome,
                    user: userType,
                    team: team_name,
                    question_num: question_num,
                    already_answered: req.flash('already_answered')
                });
          
                }
                else {
                    outcome = `Good job! You guessed correctly and gained ${finalBet} points!`;
                    let newTotal = total + finalBet;
                    console.log(newTotal);
                    let q_num = req.session.questionNum;
                    let teamScore = await updateTeamScore(newClient, team_name, guess, q_num, newTotal);
    
                  /*  if(typeof teamInfo.lastQuestionAnswered !== 'undefined'){
                        lastQuestionAnswered = teamInfo.lastQuestionAnswered;
                    }*/
                    //hideNextButton = false;
                       
                    }
        }
        else if(guess !== req.session.finalQuestion.correct && userType == 'captain') {
            outcome = `Sorry, you guessed incorrectly. Minus ${finalBet} points.`;
            let newTotal = total - finalBet;
            console.log(newTotal);
            let q_num = req.session.questionNum;
            let teamScore = await updateTeamScore(newClient, team_name, guess, q_num, newTotal);
            //hideNextButton = false;
        }
        else {
            outcome = `Waiting on captain's answer.`;
            //hideNextButton = true;
        }
    }
    catch(err){
        console.log(err);
    } 
    finally {
        await client.close();
    }

    res.render('final_answer', {
        correctAnswer: req.session.finalQuestion.correct,
        guessedAnswer: guess,
        points: finalBet,
        result: outcome,
        user: userType,
        team: team_name,
        question_num: question_num,
        already_answered: req.flash('already_answered')
    });
});

app.post('/check_answered', async(req, res) => {
    //res.send(hideNextButton);
    const team_name = req.body.teamName;
    const question_num = req.body.question_num;
    console.log(team_name);

    const client = new MongoClient(process.env.MONGO_CONNECT, {useUnifiedTopology: true });

    try {
        // Connect to the MongoDB cluster 
        await client.connect();
        let findTeam = await findTeamInfo(client, team_name);
        if(findTeam.lastQuestionAnswered >= question_num){
            console.log("Question has been answered.");
            res.redirect('/trivia');
        }
        else {
            console.log("Captain has not answered question.");
            res.render('check_if_answered', {
                teamName: team_name,
                questionNum: question_num
            });
        }
    }
    catch(err){
        console.log(err);
    } 
    finally {
        await client.close();
    }
    
});

app.get('/check_if_answered', async(req, res) => {
    const team_name = req.body.teamName;
    const question_num = req.body.question_num;
    console.log(team_name);

    const client = new MongoClient(process.env.MONGO_CONNECT, {useUnifiedTopology: true });

    try {
        // Connect to the MongoDB cluster
        await client.connect();
        let findTeam = await findTeamInfo(client, team_name);
        if(findTeam.answers.length >= question_num){
            console.log("Question has been answered.");
            res.redirect('/trivia');
        }
        else {
            console.log("Captain has not answered question.");
            res.render('check_if_answered', {
                teamName: team_name,
                questionNum: question_num
            });
        }
    }
    catch(err){
        console.log(err);
    } 
    finally {
        await client.close();
    }    
}); 

app.post('/final_bet', async(req, res) => {
    const bet = Number(req.body.bet);
    const team = req.body.team;

    req.session.questionNum = questionDataClone.length-1;

    const client = new MongoClient(process.env.MONGO_CONNECT, {useUnifiedTopology: true });

    try {
        // Connect to the MongoDB cluster
        await client.connect();    
        let submitBet = await submitFinalBet(client, team, bet);   
        
        res.redirect('/final_question');
    }
    catch(err){
        console.log(err);
    } 
    finally {
        await client.close();
    }
});
/*
app.get('/show_score', async(req, res) => {
    
});
*/
//newUser signup
app.post('/validate', async (req, res) => {
    let data = req.body;
    let home = req.body.homepage;
    let d = new Date();
    let currDate = d.toDateString();
    let currentDate = d.toLocaleTimeString();
    let newDate = `${currDate} ${currentDate}`;
    let index = 0;

    let emailData = {firstName: data.firstName, lastName: data.lastName, team: data.team, email: data.email, timeStamp: newDate};
    //req.body;
    const client = new MongoClient(process.env.MONGO_CONNECT, {useUnifiedTopology: true });

    //NEED TO LOOK FOR DUPLICATE REQUEST! (e.g., if a user's email has already been used)
    
    try {
        // Connect to the MongoDB cluster
        await client.connect();

        await createListing(client, 'newUser', emailData);
    }

    catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }

//main().catch(console.error);

     let transport = nodemailer.createTransport({
        host: process.env.EMAIL_SERVER,
        port: process.env.EMAIL_PORT,
        auth: {
          user: process.env.USER,
          pass: process.env.PASSWORD
        }
     })

    const message = {
        from: process.env.EMAIL, // Sender address
        to: process.env.EMAIL,  // List of recipients
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
    
    res.render('validate_user');
    
    console.log(home);
});
/*
//need to install method-override b/c html doesn't support delete
app.delete('/logout', (req, res) => {
    //logOut is a passport method
    req.logOut();
    res.redirect('/login');
});

const checkAuthenticated = (req, res, next) => {
    //isAuthenticated is a passport method
    if(req.isAuthenticated()){
        return next(); //if authenticated, go on to next function in middleware
    }
    res.redirect('/login');
};
//don't want user to login again if already logged in, or register again if already logged in
const checkNotAuthenticated = (req, res, next) => {
    if(req.isAuthenticated()){
        return res.redirect('/');
    }
    next();
};
*/