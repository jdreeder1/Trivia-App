const LocalStrategy = require('passport-local').Strategy

const initialize = (passport, getUserByEmail) => {
    const authenticateUser = (email, password, done) => {
        const user = getUserByEmail(email);
        if(user == null){
            return done(null, false, {message: 'No user with that email'});
        }

    };
    passport.use(new LocalStrategy({usernameField: 'email', passwordField: 'pw'}), authenticateUser);
    //serialize user with unique id number
    passport.serializeUser((user, done) => {});
    passport.deserializeUser((id, done) => {});

};

module.exports = initialize;

//login.ejs is the user register screen
//user_signin.ejs is user login screen, admin_login.ejs is admin login screen
//user_signin.ejs posts to /signin, admin_login.ejs posts to /admin_signin
