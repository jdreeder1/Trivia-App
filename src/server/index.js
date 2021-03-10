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
const limiter = require('express-rate-limit')
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
io.on('connection', async(socket) => {
    const socketId = socket.id;
    const client = new MongoClient(process.env.MONGO_CONNECT, {useUnifiedTopology: true });
    
    try {
        // Connect to the MongoDB cluster
        await client.connect();
    //const userId = await fetchUserId(socket);
        socket.on('joinChat', async(data) => { 
            socket.join(data.team);
            let msg = `<i>${data.handle} has joined the chat</i>`;
            await storeTeamMessages(client, data.team, msg); //NEED TO FIX!
            let teamInfo = await findTeamInfo(client, data.team);
            let msgs = teamInfo.chat;
            //STORE MESSAGES ON TEAM DATABASE AND RETRIEVE WHEN USER PRESSES 'JOIN' ON CLIENT SIDE
            //console.log(`Joined ${data.team} chat`);
    //        callback(messages[data.team]);
            //io.in(data.team).emit('joinChat', msg);
            io.to(socketId).emit('joinChat', msgs); //send chat history only to new person who joined
            console.log(msgs);   
        });

        //listen to msg from client and send out to all clients connected to same port
        socket.on('chat', async(data) => { 
            //io.sockets.emit('chat', data);
            let msg = `<strong>${data.handle}:</strong> ${data.message}`;
            await storeTeamMessages(client, data.team, msg);
            io.in(data.team).emit('chat', data);
        });

        socket.on('genChatJoin', async(data) => {
            socket.join('generalChat');
            let msg = `<i>${data.handle} has joined the chat</i>`;
            await storeGeneralChat(client, msg); //NEED TO FIX!
            let info = await findGeneralChat(client);
            let msgs = info.generalChat;

            //io.in('generalChat').emit('genChatJoin', msgs);

            io.to(socketId).emit('genChatJoin', msgs); //send chat history only to new person who joined

        });

        socket.on('generalChat', async(data) => {
            let msg = `<strong>${data.handle}:</strong> ${data.message}`;  
            await storeGeneralChat(client, msg);
            io.in('generalChat').emit('generalChat', data); 
        });        

        socket.on('adminJoin', async(data) => {
            let msg = `<p><i>${data.handle} has joined the chat</i></p>`;
            await storeGeneralChat(client, msg);
            io.sockets.emit(msg);
        });

        socket.on('adminChat', async(data) => {
            let teamArr = await findAllTeams(client);
            let msg = `<p><strong>${data.handle}:</strong> ${data.message}</p>`;
                for(let tm of teamArr){
                    await storeTeamMessages(client, tm, msg); //NEED TO FIX!
                    socket.to(tm).emit(data);
                }
            //socket.broadcast.emit(data);
        })
    }
    catch(err){
        console.log(err);
    }

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

const storeTeamMessages = async(client, team, message) => {
    let result = await client.db("woodys_trivia").collection("teams")
                .updateOne(
                    {teamName: team},
                    {$push: { chat: message }}   
                );
        if(result){
            console.log('Message stored!');
        }
        else {
            console.log('Unable to store message!');
        }
};

const storeGeneralChat = async(client, message) => {
    let result = await client.db("woodys_trivia").collection("admin_login")
                .updateOne(
                        {purpose: "chat"},
                        {$push: { generalChat: message }}   
                    );
        if(result){
            console.log('Message stored!');
        }
        else {
            console.log('Unable to store message!');
        }
};

const findGeneralChat = async(client) => {
    let result = await client.db("woodys_trivia").collection("admin_login")
                    .findOne({ purpose: "chat" });

        if (result) {
        //console.log(`Found a listing in the collection with the name '${nameOfListing}':`);
        //console.log(result);
        return result;
        } else {
        console.log(`No listings found!'`);
        return false;
        }  
}

const resetTotal = async(client, team) => {
    //POSSIBLE TO DO ITERATIVE UPDATES?
    //MIGHT CONSIDER DELETING ALL KEY/VALUES NEED TO RESET - IF UPSET, WILL SHOW UP ANYWAY
try {
        await client.db("woodys_trivia").collection("teams")
    //db.getCollection('docs').update({ },{'$pull':{ 'items':{'id': 3 }}},{multi:true})
                    .updateOne(
                        {teamName: team},
                        {$set: {runningTotal: 15}},
                        { upsert: true }
                    );
        await client.db("woodys_trivia").collection("teams")
        //db.getCollection('docs').update({ },{'$pull':{ 'items':{'id': 3 }}},{multi:true})
                        .updateOne(
                            {teamName: team},
                            {$set: {finalBet: 0}},
                            { upsert: true }
                        );
        await client.db("woodys_trivia").collection("teams")
                        .updateOne(
                            {teamName: team},
                            {$set: {lastQuestionAnswered: 0}},
                            { upsert: true }
                        );
        await client.db("woodys_trivia").collection("teams")
                        .updateOne(
                            {teamName: team},
                            {$set: {chat: []}},
                            { upsert: true }
                        );
        await client.db("woodys_trivia").collection("admin_login")
                        .updateOne(
                            {purpose: "chat"},
                            {$set: {generalChat: []}},
                            { upsert: true }
                        );
        await client.db("woodys_trivia").collection("teams")
                        .updateOne(
                            {teamName: team},
                            {$set: {loggedInUsers: []}},
                            { upsert: true }
                        );
        await client.db("woodys_trivia").collection("teams")
                        .updateOne(
                            {teamName: team},
                            {$set: {finalAnswer: ""}},
                            { upsert: true }
                        );
    }
    catch(err){
        console.error(err);
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

const findAllTeams = async (client) => {
    let cursor = await client.db("woodys_trivia").collection("teams")
                        .find({});

    const results = await cursor.toArray();

    let teamArr = [];

    for(let x of results){
        teamArr.push(x.teamName);
    }

    return teamArr;

};

const updateStartTime = async(client, dt, time) => {
    let result = await client.db("woodys_trivia").collection("questions")
                    .updateOne(
                        {event: "trivia"},
                        {$set: {startDate: dt, startTime: time}},
                        {upsert: true}
                    );

    console.log(`${result.matchedCount} document(s) matched the query criteria. Start time updated.`);     

};

const updateCategory = async(client, category) => {
    let result = await client.db("woodys_trivia").collection("admin_login")
                    .updateOne(
                            {purpose: "chat"},
                            {$set:
                                {final_category: category} 
                            },
                            {upsert: true}
                        );

        console.log(`${result.matchedCount} document(s) matched the query criteria.`);      
}

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
const submitFinalAnswer = async(client, team, answer) => {
    let result = await client.db("woodys_trivia").collection("teams")
                    .updateOne(
                        {teamName: team},
                        { $set: {finalAnswer: answer}},
                        {upsert: true}
                    );

        console.log(`${result.matchedCount} document(s) matched the query criteria. Final bet sumbitted.`);     

};

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
    }

};

const adjustTeamCaptain = async(client, team, email) => {
    let result = await client.db("woodys_trivia").collection("teams")
                    .updateOne(
                        {teamName: team}, 
                        {$set:
                            {captain : email}
                        },
                        {upsert: true}
                    );
        if(result){                    
            console.log(`${result.matchedCount} document(s) matched the query criteria. Team captain updated.`);
        }
        else{
            console.log('Error - could not update team captain.');
        }    
};

const adjustTeamScore = async(client, team, num_points) => {
    let result = await client.db("woodys_trivia").collection("teams")
                    .updateOne(
                        {teamName: team}, 
                        {$set:
                            {runningTotal : num_points}
                        },
                        {upsert: true}
                    );
        if(result){                    
            console.log(`${result.matchedCount} document(s) matched the query criteria. Score updated.`);
        }
        else{
            console.log('Error - could not update team score.');
        }
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
    let category = data.category;
    
    let newDt = new Date(Date.parse(`${data.start_date}`));
    
    console.log(newDt);

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
            await updateCategory(client, category)
        )
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
        .then(
            res.render('create_questions')
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
    const loggedIn = [];
    const messages = [];

    let teamData = {teamName: data.teamName, captain: data.captain, finalBet: 0, lastQuestionAnswered: 0, loggedInUsers: loggedIn, runningTotal: 15, finalAnswer: '', chat: messages};

    //make sure team created isn't already in DB, make sure captain email isn't assigned to 2 diff teams
    const client = new MongoClient(process.env.MONGO_CONNECT, {useUnifiedTopology: true });

    //NEED TO LOOK FOR DUPLICATE REQUEST! (i.e., if a user's email has already been used)
    
    try {
        // Connect to the MongoDB cluster
        await client.connect();

        let foundTeam = await findOneListingByName(client, 'teams', teamData.teamName);

        if(foundTeam){
            //res.send(`<p>Team already exists! Create a different team!</p><br> 
            //<a href='src/client/views/create_team.html'<button>Go Back</button></a>`);
            req.flash('team_exists', 'Team already exists! Create a different team!')
            res.render('create_team', {
                exists: req.flash('team_exists'),
                created: ''    
            });
        }
        else {
            req.flash('team_created', 'New team created!')
            await createListing(client, 'teams', teamData);
            res.render('create_team', {
                exists: '',
                created: req.flash('team_created')
            });
            //res.send(`<p>New team created! Create another team?</p><br> <a href='src/client/views/create_team.html'<button>Create Another Team</button></a>`);
        }
    }

    catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }

});

app.get('/admin_login', async(req, res) => {
    
    res.render('admin_login', {
        lgnError: req.flash('loginError')
    });
    
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
            req.session.adminStatus = true;
            res.render('admin_options');
        }
        else {
            req.flash('loginError', 'Invalid login information!');
            res.redirect('/admin_login');
        }
            
            //res.send(`<p>Login info not found! Try again?</p><br> <a href='/admin_login'><button>Admin Login</button></a>`);
    }

    catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
});

app.post('/admin_home', async(req, res) => {
    res.render('admin_options');
});

app.post('/create_team', (req, res) => {
    res.render('create_team', {
        exists: '',
        created: ''
    });
});

app.post('/create_questions', (req, res) => {
    res.render('create_questions');
});

app.post('/start_trivia', (req, res) => {
    res.render('monitor_trivia');
});

app.post('/adjust_captain', async(req, res) => {
    const {team, email} = req.body;
    const client = new MongoClient(process.env.MONGO_CONNECT, {useUnifiedTopology: true });
    try {
        await client.connect();
        await adjustTeamCaptain(client, team, email);
        res.render('monitor_trivia');
    }
    catch(error){
        console.log(error);
    }
    finally {
        await client.close();
    }
});

app.post('/adjust_points', async(req, res) => {
    console.log(req.body.points);
    let points = Number(req.body.points);
    let team = req.body.team;

    const client = new MongoClient(process.env.MONGO_CONNECT, {useUnifiedTopology: true });

    try {
        // Connect to the MongoDB cluster
        await client.connect();
        let tm = await findTeamInfo(client, team);
        let adjustment = tm.runningTotal + points;
        try {
            await adjustTeamScore(client, team, adjustment);
            res.render('monitor_trivia');
        }
        catch(err){
            console.log(err);
        }
    }
    catch(error){
        console.log(error);
    }
    finally {
        await client.close();
    }
})

app.post('/reset', async(req, res) => {
    const client = new MongoClient(process.env.MONGO_CONNECT, {useUnifiedTopology: true });

    try {
        // Connect to the MongoDB cluster
        await client.connect();
        let teamArr = await findAllTeams(client);
        try {
            for(let tm of teamArr){
                await resetTotal(client, tm);
            }
            res.redirect('/');
        }
        catch(err){
            console.error(err);
        }
    }
    catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
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
                }       
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
            //res.send(true);
            res.redirect('/');
            //res.render('login');
        }
    }
    catch (err) {
        console.error(err);
    } finally {
        await client.close();
    }
    
});

app.post('/general_chat', async(req, res) => {
    //console.log(req.body);
    res.render('general-chat', {
        userName: req.body.userName
    }); 
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
                console.log(`Question length: ${questionDataClone.length}`);
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

app.get('/get_qs', async(req, res) => { 

    if(req.session.adminStatus == true){
        const client = new MongoClient(process.env.MONGO_CONNECT, {useUnifiedTopology: true });
        try {
            await client.connect();

            let foundQuestions = await findQuestions(client);
            let findCategory = await findGeneralChat(client);
            foundQuestions.push(findCategory.final_category);
            res.json(foundQuestions);
        }    
        catch(err){
            res.send(err);
        }
        finally {
            await client.close();
        }
    }
    else {
        res.sendStatus(404);
    }
    
});

app.get('/standings', async(req, res) => {
    if(req.session.adminStatus == true){
        const client = new MongoClient(process.env.MONGO_CONNECT, {useUnifiedTopology: true });
        try {
            await client.connect();

            let teams = await getAllTeamScores(client);
            res.json(teams);
        }
        catch (err) {
            //console.log(err);
            res.send(err)
        }
        finally {
            await client.close();
        }
    }
    else {
        res.sendStatus(404);
    }
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
    if(index+1 <=questionDataClone.length-2){
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
    if (req.session.questionNum == questionDataClone.length - 1){       
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
    }
    else { 
        res.sendStatus(404);
    }
});

app.get('/wager', async(req, res) => {
    let teamObj = {};
    let teamNames = [];
    let teamTotals = [];
    let index;
    let categ;
if (req.session.questionNum == questionDataClone.length - 1){       
    const client = new MongoClient(process.env.MONGO_CONNECT, {useUnifiedTopology: true });

    try {
        // Connect to the MongoDB cluster
        await client.connect();
        let teamScores = await getAllTeamScores(client);
        categ = await findGeneralChat(client);

        if(teamScores){
            for(let teams of teamScores){
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
        category: categ.final_category,
        team: req.session.userDetails.triviaTeam,
        teamScore: teamTotals[index],
        teamNames: teamNames,
        teamTotals: teamTotals,
        question_num: req.session.questionNum,
        login_error: req.flash('login_error')
    });
}
else {
    res.sendStatus(404);
}
    
});

const showScores = async(req, res) => {
    let teamNames = [];
    let teamTotals = [];
    let index;

    const client = new MongoClient(process.env.MONGO_CONNECT, {useUnifiedTopology: true });

    try {
        // Connect to the MongoDB cluster
        await client.connect();
        let teamScores = await getAllTeamScores(client);

        if(teamScores){
            for(let teams of teamScores){
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
} 

app.post('/final_results', async(req, res) => {
    await showScores(req, res);
});
app.get('/scores', async(req, res) => {
    await showScores(req, res);
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
    let options = [req.session.currentQuestion.option1, req.session.currentQuestion.option2, req.session.currentQuestion.option3, req.session.currentQuestion.option4];

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
                
            }
            else {
                outcome = `Good job! You guessed correctly and gained ${confidence} points!`;
                let newTotal = total + confidence;
                console.log(newTotal);
                let q_num = req.session.questionNum;
                let teamScore = await updateTeamScore(newClient, team_name, guess, q_num, newTotal);

                    res.render('answer', {
                        correctAnswer: req.session.currentQuestion.correct,
                        guessedAnswer: guess,
                        points: confidence,
                        result: outcome,
                        user: userType,
                        team: team_name,
                        question_num: question_num,
                        choices: options,
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
                choices: options,
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
                choices: options,
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
    const finalAnswer = req.body.finalAnswer;
    let outcome = '';
    let total;
    let finalBet;
    let teamInfo;
    let finalGuess;
    let options = [req.session.finalQuestion.option1, req.session.finalQuestion.option2, req.session.finalQuestion.option3, req.session.finalQuestion.option4];

    //let finalQuestion = questionDataClone[questionDataClone.length-1];

    console.log(guess, team_name, userType, question_num);

    const client = new MongoClient(process.env.MONGO_CONNECT, {useUnifiedTopology: true });

    try {
        // Connect to the MongoDB cluster
        await client.connect();

        if(userType == 'captain'){
            let subAnswer = await submitFinalAnswer(client, team_name, guess);
        } 
        //MAKE SURE RETRIEVE FINAL ANSWER WORKS FOR PLAYER!!
        teamInfo = await findTeamInfo(client, team_name);
        try {
            total = teamInfo.runningTotal;
            finalBet = teamInfo.finalBet;
            finalGuess = teamInfo.finalAnswer;
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
                    lastQ: finalGuess,
                    choices: options,
                    already_answered: req.flash('already_answered')
                });
          
                } 
                else {
                    outcome = `Good job! You guessed correctly and gained ${finalBet} points!`;
                    let newTotal = total + finalBet;
                    console.log(newTotal);
                    let q_num = req.session.questionNum; 
                    let teamScore = await updateTeamScore(newClient, team_name, guess, q_num, newTotal);
                       
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
        lastQ: finalGuess,
        choices: options, //UPDATE ON CLIENT-SIDE!
        already_answered: req.flash('already_answered')
    });
});

app.post('/check_answered', async(req, res) => {
    //res.send(hideNextButton);
    const team_name = req.body.teamName;
    const question_num = req.body.question_num;
    let outcome = '';
    let total;
    let finalBet;
    let findTeam;
    let guess;
    let options = [req.session.finalQuestion.option1, req.session.finalQuestion.option2, req.session.finalQuestion.option3, req.session.finalQuestion.option4];
    //questionDataClone.length - 1;
    //console.log(team_name);
    console.log(`This is question number ${question_num}, questionDataClone length-1: ${questionDataClone.length-1}`);

    //KEEP GETTING ERROR 404 WHEN PLAYER HITS 'GET RESULTS' AFTER FINAL QUESTION

    const client = new MongoClient(process.env.MONGO_CONNECT, {useUnifiedTopology: true });
    //if question_num == finalAnswer
    try {
        // Connect to the MongoDB cluster 
        await client.connect();
        findTeam = await findTeamInfo(client, team_name);
        total = findTeam.runningTotal;
        finalBet = findTeam.finalBet;
        guess = findTeam.finalAnswer;

        console.log(guess);
        if(findTeam.lastQuestionAnswered >= question_num && guess == '' && question_num == questionDataClone.length-1){
            console.log('captain has not answered final question'); 
            res.render('check_if_answered', {
                teamName: team_name, 
                questionNum: question_num
            });
        }
        else if(findTeam.lastQuestionAnswered >= question_num && guess !== ''){ 
            if(guess == req.session.finalQuestion.correct){
                outcome = `Good job! You guessed correctly and gained ${finalBet} points!`;
            }
            else {
                outcome = `Sorry, you guessed incorrectly. Minus ${finalBet} points.`;
            }
                res.render('final_answer', {
                    correctAnswer: req.session.finalQuestion.correct,
                    guessedAnswer: guess,
                    points: finalBet,
                    result: outcome,
                    user: req.session.userDetails.userType,
                    team: team_name,
                    lastQ: guess,
                    choices: options, //UPDATE ON CLIENT-SIDE!
                    question_num: question_num,
                    already_answered: ''
                });
        }
        else if(findTeam.lastQuestionAnswered >= question_num && guess == '' && question_num !== questionDataClone.length-1){
            console.log("Question has been answered.");
            res.redirect('/trivia');
        } 
        else {
            console.log('captain has not answered'); 
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

    if(req.session.userDetails.userType == 'captain'){
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
    }
    else {
        res.redirect('/final_question');     
    }
    
});

const registerLimiter = limiter({
    windowMs: 1000 * 60 * 5,
    max: 1, 
    message: {
        code: 429,
        message: 'Reached limit! Too many requests!'
    },
})

//newUser signup
app.post('/validate', registerLimiter, async (req, res) => {
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