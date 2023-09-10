const express = require('express');
const fs = require('fs');
const path = require('path');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const methodOverride = require('method-override')
const session = require('express-session');
const fileUpload = require('express-fileupload');
const MongoStore = require('connect-mongo');
const nunjucks = require('nunjucks');
const flash = require('connect-flash');
const favicon = require('serve-favicon');

require('dotenv').config();

const {
  mongoUri,
  maxAge,
  secret,
  host,
  adminUrl,
  imageUrl,
  adminImageUrl,
  imageBase,
  tempUploadPath,
} = require('./config/constants');

const app = express();

fs.readdirSync('./models').forEach(file => {
  const model = file.split('.')[0];
  if (model) require('./models/' + model);
});

// view engine setup
app.set('views', path.join(__dirname, 'admin/views'));
app.set('view engine', 'nunjucks');

const env = nunjucks.configure('admin/views', {
  autoescape: true,
  watch: true,
  express: app,
});

env.addFilter(
  'dateFilter',
  time => (time && time != '' && time.toDateString() ? time.toDateString() : ''),
);

// uncomment after placing your favicon in /public
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
//app.use(logger('dev'));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: false }));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  cookie: { maxAge },
  store: MongoStore.create({ mongoUrl: mongoUri }),
  secret,
  resave: false,
  saveUninitialized: false,
}));

app.use(flash());
app.use(fileUpload({
  limits: { fileSize: 1 * 1024 * 1024 },
  createParentPath: true,
  useTempFiles : true,
  tempFileDir : tempUploadPath,
  safeFileNames: true,
  preserveExtension: true,
  abortOnLimit: true,
  parseNested: true,
  uploadTimeout: 2000,
}));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Methods','GET,POST,PUT,DELETE,OPTIONS');	
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, os, version, ssid, access_token ');
	// console.dir({
	// 	body: req.body, 
	// 	params: req.params,
	// 	query: req.query,
	// 	query: req.headers
	// });
  next();
});
app.use(methodOverride());

app.use((req, res, next) => {
  res.locals.error_flash = req.flash('error')[0];
  res.locals.success_flash = req.flash('success')[0];
  res.locals.error = req.flash('error').toString()
  res.locals.success = req.flash('success').toString();
  res.locals.host = host;
  res.locals.admin_url = adminUrl;
  res.locals.image_url = imageUrl;
  res.locals.admin_image_url = adminImageUrl;
  res.locals.image_base = imageBase;
  res.locals.user = req.session.user;

  /*console.dir({ 
  	path: req.originalUrl, 
  	body: req.body, 
  	params: req.params,
  	query: req.query
  });*/
  next();
});

fs.readdirSync(path.join(__dirname, 'admin', 'routes')).forEach(filename => {
  const route = require(path.join(__dirname, 'admin', 'routes', filename));
  app.use('/admin', route);
});
// catch 404 and forward to error handler
app.use((req, res, next) => {
	const err = new Error('Not Found');
	err.status = 404;
	next(err);
});

// error handler
app.use((err, req, res, next) => console.error("app error handler called", err));

module.exports = app;
