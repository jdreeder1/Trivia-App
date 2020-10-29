const dotenv = require('dotenv');
dotenv.config();

const path = require('path')
const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const nodemailer = require('nodemailer')
const {MongoClient} = require('mongodb') //use to connect to mongo cluster
const ejs = require('ejs')

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

app.set('view engine', 'ejs');

const rootPath = `C:/xampp/htdocs/Trivia/src`;
let emailData = {};
let user = '';
let triviaTeam = '';

//tells express where to look for stylesheets
//app.use(express.static('/src/client'));

app.get('/', (req, res) => {
    //let p = path.join(__dirname, 'src/client/index.html');
    //res.sendFile('C:/xampp/htdocs/Trivia/src/client/views/create_questions.html');
    //res.sendFile('/client/views/login.html', { root: rootPath});
    res.render('login');
    //console.log(rootPath);
});

const port = Number(process.env.PORT || 3330);
// designates what port the app will listen to for incoming requests
app.listen(port, ()=>{
    console.log(`Server running on port ${port}!`);
    console.log('Email port: ', process.env.EMAIL_PORT);
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

const updateTeamScore = async(client, team, num_points) => {
    let result = await client.db("woodys_trivia").collection("teams")
                    .updateOne(
                        {teamName: team}, 
                        {$set:
                            {runningTotal : num_points}
                        },
                        {upsert: true}
                    );
        console.log(`${result.matchedCount} document(s) matched the query criteria.`);     
};

const getTeamInfo = async(client, team) => {
    let result = await client.db("woodys_trivia").collection("teams")
                    .findOne({teamName: team});
    if(result){
        return result;
    }
    else {
        return false;
    }
};

//instead of posting team answer for each question, pull correct answer from server endpoint and compare with answer team provided, then 
//update score accordingly

app.post('/post_qs', async (req, res) => {
    const data = req.body;

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
        await updateAllListingsToHavePropertyType(client, 'q1', question1)
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

app.get('/get_qs', async (req, res) => {
    const client = new MongoClient(process.env.MONGO_CONNECT, {useUnifiedTopology: true });

    try {
        // Connect to the MongoDB cluster
        await client.connect();
        let questions = await findQuestions(client);
        
        try {
            questionData = questions;
            //create element and append!
           /*
            let markup = '';
            questions.forEach((question) => {
                markup += `${JSON.stringify(question)}`;
            });
            //let re = /}{/g;
            let str = markup.replace(/}{/g, '}~{');
            let arr = str.split('~');
        
            let firstQ = JSON.parse(arr[0]); 
            */
            res.send(questions);
            //console.log(typeof(firstQ));
             /*
            let markup = '';
            for(let i=0; i<questions.length; i++){
                markup += `<div>Question ${i+1}<br>${questions[i].q}<br>
                    A.)<span>${questions[i].option1}</span> &nbsp; B.)<span>${questions[i].option2}</span> &nbsp; C.)<span>${questions[i].option3}</span> &nbsp; D.)<span>${questions[i].option4}</span>
                </div>`;
            }
            res.send(`${markup}<br><button>Confirm?</button> &nbsp; <button><a href='src/client/views/create_questions.html'>Go Back</a></button>`);
        */
        }
        catch(err){
            console.log(err);
        }
        
    }
    catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
});

app.post('/post_team', async (req, res) => {
    const data = req.body;

    let teamData = {teamName: data.teamName, captain: data.captain, runningTotal: 15};

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
            res.send(`<p>Welcome, admin! Would you like to Create a Team or Create Questions?</p><br> <a href='/create_team'><button>Create Team</button></a> &nbsp; <a href='/create_questions'><button>Create Questions</button></a>`);
        }
        else {
            res.send(`<p>Login info not found! Try again?</p><br> <a href='src/client/views/admin_login.html'><button>Admin Login</button></a>`);
        }
    }

    catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
});

app.get('/create_team', (req, res) => {
    res.render('create_team');
});

app.get('/create_questions', (req, res) => {
    res.render('create_questions');
});

app.get('/user_login', (req, res) => {
    res.render('user_signin');
});

//verified user login
app.post('/signin', async (req, res) => {
    const data = req.body;
    //data.email, data.pw

    const client = new MongoClient(process.env.MONGO_CONNECT, {useUnifiedTopology: true });

    try {
        // Connect to the MongoDB cluster
        await client.connect();

        let foundUser = await findUserLogin(client, 'teams', data);

        if(foundUser.captain){
            user = 'captain';
            triviaTeam = foundUser.team;
            //res.redirect('/question1');
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
        }
        else if(foundUser.player){
            console.log(foundUser);
            user = 'player';
            triviaTeam = foundUser.team;
            //res.redirect('/question1'); 
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
        }
        else {
            res.send(`${foundUser.err} <a href="/user_login"><button>Try Again</button></a> &nbsp; <a href="/"><button>Home</button></a>`);
        }
        /*
        else {
            res.send(`<p>Login info not found! Try again?</p><br> <a href='src/client/views/admin_login.html'<button>Admin Login</button></a>`);
        }*/
    }

    catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }

});

app.get('/questions', async(req, res) => {
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
                questionData = foundQuestions;
                console.log(questionData[0]);
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

});

app.get('/trivia', async(req, res) => {
    //res.send(questionData[0]);  
    //don't need to specify file type ejs b/c already specified ejs as template 
    console.log(user);
    res.render('index', {
        questions: questionData,
        typeOfUser: user,
        team: triviaTeam
    });
});

app.post('/get_answer1', async(req, res) => {

    const guess = req.body.answer;
    const confidence = Number(req.body.confidence); 
    const q_no = Number(req.body.q_no);
    const team_name = req.body.teamName;
    let outcome = '';
    let total;

    console.log(team_name);

    const client = new MongoClient(process.env.MONGO_CONNECT, {useUnifiedTopology: true });

    try {
        // Connect to the MongoDB cluster
        await client.connect();
    
        let teamInfo = await getTeamInfo(client, team_name);
        try {
            console.log(teamInfo.runningTotal);
            total = teamInfo.runningTotal;
        }
        catch(err){
            console.log(err);
        } 
        //total = teamInfo.runningTotal;
        //console.log(typeof(total), total);
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

        if(guess == questionData[q_no].correct){
            outcome = `Good job! You guessed correctly and gained ${confidence} points!`;
            let newTotal = total + confidence;
            console.log(newTotal);
            let teamScore = await updateTeamScore(newClient, team_name, newTotal);
        }
        else {
            outcome = `Sorry, you guessed incorrectly. Minus ${confidence} points.`;
            let newTotal = total - confidence;
            console.log(newTotal);
            let teamScore = await updateTeamScore(newClient, team_name, newTotal);
        }
    }
    catch(err){
        console.log(err);
    } 
    finally {
        await client.close();
    }

    
    //console.log(typeof(q_no), q_no);
    //res.send(questionData[q_no].correct);
    res.render('answer', {
        correctAnswer: questionData[q_no].correct,
        guessedAnswer: guess,
        points: confidence,
        result: outcome
    });
    
    //res.redirect('/show_results');
});
/*
app.get('/show_score', async(req, res) => {
    
});*/

//newUser signup
app.post('/validate', async (req, res) => {
    let data = req.body;
    let home = req.body.homepage;
    let d = new Date();
    let currDate = d.toDateString();
    let currentDate = d.toLocaleTimeString();
    let newDate = `${currDate} ${currentDate}`;
    let index = 0;

    emailData = {firstName: data.firstName, lastName: data.lastName, team: data.team, email: data.email, timeStamp: newDate};
    //req.body;
    const client = new MongoClient(process.env.MONGO_CONNECT, {useUnifiedTopology: true });

    //NEED TO LOOK FOR DUPLICATE REQUEST! (i.e., if a user's email has already been used)
    
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
    
    res.send(`<p>Your request to create an account is being reviewed. You will receive an email from us shortly.</p><br>
    <a href='/'><button>Home</button></a>
    `);
    
    console.log(home);
});
