const { EmailTemplate } = require('email-templates');
const crypto = require('crypto');
const _ = require('lodash');
const path = require('path');
const Validator = require('validatorjs');
const nodemailer = require('nodemailer');
const { google } = require('googleapis');
const { Readable } =  require('stream');

const {
  adminUrl,
  smtpFrom,
  smtpHost,
  smtpService,
  smtpAuthUser,
  smtpAuthPass,
  fromMail,
  scopes,
  driveUploadFolderId,
} = require('../config/constants');
const pkey = require('../config/prime-chess-397807-d45e7fde6c1f.json');

const transport = nodemailer.createTransport({
  from: smtpFrom,
  host: smtpHost, // hostname
  service: smtpService,
  auth: {
    user: smtpAuthUser,
    pass: smtpAuthPass,
  },
});

module.exports = {
  Auth: (req,res,next) => {
    if (req.url === '/login' || req.url === '/forgotPassword') {
      if (req.session.user) {
        return res.redirect(adminUrl);
      }
      return next();
    } else if (req.session.user) {
      return next();
    } else {
      req.flash('error', 'Unauthorized Access');
      return res.redirect('/admin/login');
    }
  },
  adminAuth: (req, res, next) => {
    if (req.session.user && req.session.user.isAdmin) return next();
    else {
      req.flash('error', 'Unauthorized Access');
      return res.redirect('/admin/login');
    }
  },
  capitalize: body => {
    Object.keys(body).forEach(element => {
      body[element] = body[element].split(' ')
      .map(elem => {
        if (element !== 'email' && element !== 'password' && element !== 'type') {
		      elem = _.capitalize(elem);
		    }
        return elem;   
      }).join(' ');    
    });    
    return body;
  },
  randomNumber: (length,charset) => {
    const charSet = charset || '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    let i = 0, rnum, random = '';
    while (i < length) {
      rnum = Math.floor(Math.random() * charSet.length);
      random += charSet.substring(rnum, rnum + 1);
      i++;
    }
    return random;
  },
  crypto: (text, type) => {
    const algorithm = 'aes256'; // or any other algorithm supported by OpenSSL
    const key = 'password';

	  if (type.toString() === 'encrypt') {
      const cipher = crypto.createCipher(algorithm, key);
      const encrypted = cipher.update(text.toString(), 'utf8', 'hex') + cipher.final('hex');
      return encrypted.toString();
    } else {
      const decipher = crypto.createDecipher(algorithm, key);
      const decrypted = decipher.update(text.toString(), 'hex', 'utf8') + decipher.final('utf8');
      return decrypted.toString();
    }
  },
  sendMail: (_, email, email_data, cb) => {
    const template = new EmailTemplate(path.join(__dirname, '../templates/', template));

    if (!template) return cb("template not found");
    // Send a single email
    template.render(email_data, (err, results) => {
      if(err) return cb(err, null);
      transport.sendMail(
	      {
          from: fromMail,
          to: email,
          subject: results.subject,
          html: results.html,
          //text: results.text,
        }, 
        (err, responseStatus) => cb(err, responseStatus),
	    );
	  });
  },
  validate: (rulesObj, template) => {
    return (req, res, next) => {
      // Validating Input 
      if (req?.body?.users) {
        req.body.users = JSON.parse(req?.body?.users);
      }
      const validation = new Validator(
		    req.body,
		    rulesObj,
        {
          'min.password': 'Password must be minimum of 8 characters',
          'numeric.age': 'Age Must Be In Numbers',
          'regex.contact_number': 'Phone number must be a 10 digit number',
          'regex.name': 'Name must not contain special characters',
          'required.id': 'Invalid, Please Enter Again',
          'required.lat': 'Enter a Valid Address',
          'required.lng': 'Enter a Valid Address',
          'same.confirm_password': 'Password Doesn\'t Match',
          'url.website_url': 'Enter a Valid URL',
        },
      );

      if (validation.fails()) {
        const errObj = validation.errors.all();
        req.flash('error', errObj[Object.keys(errObj)[0]][0]);
        console.log("validation failed",errObj[Object.keys(errObj)[0]][0]);
        if (template) {
          res.locals.messages = req.flash();
          res.render(template, { body: req.body });
        } else {
          res.json({ message: errObj[Object.keys(errObj)[0]][0] });
        }
      } else return next();
    };
  },
  gcloudAuthorize: async function () {
    const jwtClient = new google.auth.JWT(
      pkey.client_email,
      null,
      pkey.private_key,
      scopes,
    )
    await jwtClient.authorize();
    return jwtClient;
  },
  uploadFile: async function (file) {
    const authClient = await this.gcloudAuthorize();
    const drive = google.drive({ version: 'v3', auth: authClient });
    const random = this.randomNumber(6, '');
    const fileName = random + '-' + file.originalname;
    const { data: { id } } = await drive.files.create({
      media: {
        body: Readable.from(file.buffer),
      },
      fields: 'id',
      resource: {
        name: fileName,
        parents: [driveUploadFolderId],
      },
    });
    // await drive.permissions.create({
    //   fileId: id,
    //   requestBody: {
    //     role: 'reader',
    //     type: 'anyone',
    //   }
    // });
    return `https://drive.google.com/uc?id=${id}`;
  },
  deleteFile: async function (file) {
    const authClient = await this.gcloudAuthorize();
    const drive = google.drive({ version: 'v3', auth: authClient });
    const fileId = file.split('=')[1];
    await drive.files.delete({ fileId });
    return true;
  },
};
