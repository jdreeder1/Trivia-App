# Trivia App
Trivia app that allows an admin to create 25 multiple choice questions and approved users on separate trivia teams to answer those questions. Whichever team has the most points at the end wins.

## Installation
This project uses numerous dependencies, including:
```
"dependencies": {
  "body-parser": "^1.19.0",
    "cors": "^2.8.5",
    "dotenv": "^8.2.0",
    "ejs": "^3.1.5",
    "express": "^4.17.1",
    "express-flash": "0.0.2",
    "express-rate-limit": "^5.2.5",
    "express-session": "^1.17.1",
    "mongodb": "^3.6.2",
    "nodemailer": "^6.4.13",
    "nodemon": "^2.0.4",
    "socket.io": "^3.0.4",
    "webpack": "^4.44.1",
    "webpack-cli": "^3.3.12"
  },
  "devDependencies": {
    "@babel/core": "^7.11.1",
    "@babel/preset-env": "^7.11.0",
    "babel-loader": "^8.1.0",
    "clean-webpack-plugin": "^3.0.0",
    "css-loader": "^3.0.0",
    "html-webpack-plugin": "^3.2.0",
    "mini-css-extract-plugin": "^0.9.0",
    "node-sass": "^4.12.0",
    "optimize-css-assets-webpack-plugin": "^5.0.3",
    "sass-loader": "^7.1.0",
    "style-loader": "^0.23.1",
    "terser-webpack-plugin": "^1.4.5",
    "webpack-dev-server": "^3.11.0",
    "workbox-webpack-plugin": "^5.1.3"
  }
```

- To install these dependencies, download NPM and clone this repository. Make sure you're in the same file directory you cloned this repo to in either a NPM or Git Command Terminal, then type `npm install` to install the above dependencies. 
- Once the repo is cloned and all the dependencies are installed, make sure you're in the same directory this project is in and type `npm run build` to allow webpack to create a production build, and then, after webpack has completed the build, type `npm run start` to start the server.
- Type `localhost:3330` in your favorite browser to view the project. 

## Usage
- To create a player account, from the homepage, simply fill in your first and last name, email, and desired trivia team, then press 'Submit.- To login as a player, from the homepage, press 'Login as Player' and input your email and password, then select your preferred background theme from the drop-down menu, then press 'Submit.' If there's time remaining until trivia begins, you'll see a countdown clock on the following page if you succcessfully logged in. If the designated trivia start time has already passed, you can press 'Play Trivia' to join the active trivia session.
- If you're a team captain, you'll be able to select answers from the multiple choice options available and select how confident you are in your answer by selecting a number from 1 (not very confident) to 5 (very confident) before pressing 'Submit.' The next page will show you the correct answer, the guessed answer, and tell you the number of points you lost or gained depending on whether or not you answered correctly.
- Both team captains and team members can discuss possible answers by pressing 'Join Chat' after hovering over the '<<' symbol on the right side of the question page. Trivia players can choose to join a general chat with all players by selecting 'Join General Chat' on the next page or simply stay on their own team's chat page. Players can also check their team and their opponents' scores and logout by hovering over the '<<' symbol on the right side of the question page.
- Just before the last question, teams will see the trivia leaderboard and submit their final wager before seeing the final question. Teams can wager all of their points, as few as 1 point, or any number in between. 
- Whichever teams has the most points after all questions are answered, wins.