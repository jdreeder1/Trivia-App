# Travel App
This travel app obtains a desired trip location & date from the user, and displays weather and an image of the location using information obtained from external APIs. 

## Installation
This project uses numerous dependencies, including:
```
"dependencies": {
    "babel-jest": "^26.3.0",
    "body-parser": "^1.19.0",
    "cors": "^2.8.5",
    "dotenv": "^8.2.0",
    "express": "^4.17.1",
    "node-fetch": "^2.6.0",
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
    "jest": "^25.5.4",
    "mini-css-extract-plugin": "^0.9.0",
    "node-sass": "^4.12.0",
    "optimize-css-assets-webpack-plugin": "^5.0.3",
    "sass-loader": "^7.1.0",
    "style-loader": "^0.23.1",
    "terser-webpack-plugin": "^1.4.5",
    "webpack-dev-server": "^3.7.2",
    "workbox-webpack-plugin": "^5.1.3"
  }
```

- To install these dependencies, download NPM and clone this repository. Make sure you're in the same file directory you cloned this repo to in either a NPM or Git Command Terminal, then type `npm install` to install the above dependencies. 
- To use this app, you need to have API keys from [Geonames](http://www.geonames.org/export/web-services.html), [Weatherbit](https://www.weatherbit.io/api) and [Pixabay](https://pixabay.com/service/about/api/). 

## Usage
- Find the server-side index file by navigating through the `src` then `server` folders and opening the `index.js` file. 
- Store your API keys as variables in the `index.js` file. Replace the `process.env` variables with the variable names you used to store your API keys.  
- Make sure you're in the same file directory you cloned this repo to in either a NPM or Git Command Terminal and type `npm run build-prod` (this will cause Webpack to create a 'dist' folder, effectively building the production environment for this app).  
- Type `npm run start` in the same Command Terminal in the same directory as the previous step to setup a local server. 
- Open your preferred browser and type `localhost:3000` in the address bar and hit enter. 
- Type in the zip code and city name, select the country from the provided dropdown menu, and pick the arrival date, then click the 'Submit' button. 
- Click 'Get Results' to view the projected forecast, country flag and picture of your chosen destination.
- Click 'Save Trip' to save the trip details or 'New Trip' to input a new destination.
- Selecting 'New trip' will take you to the homepage form again, where you can pick a new destination or retrieve saved trip details by clicking the 'Retrieve Saved Trip' button.
