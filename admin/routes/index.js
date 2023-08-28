const express = require('express');
const mongoose = require('mongoose');

const FX = require('../../utils/functions');
const vrules = require('../../validation');

const router = express.Router();
const User = mongoose.model('User');

router.get('/login', FX.Auth, (req, res)=> res.render('login.html'));

router.post('/login', FX.validate(vrules.login, 'login.html'), async (req, res, next) => {
  try {
    const { contactNumber, password } = req.body;
    const primaryContact = await User.findOne({ contactNumber });
    let user = primaryContact;
    if (!primaryContact.isAdmin) {
      user = await User.findOne({ primaryContact: primaryContact._id });
    }
    if (!user) {
      req.flash('error', 'User Not Found');
      res.locals.messages = req.flash();
      return res.render('login.html');
    }
    user.comparePassword(password, (err, isMatch) => {
      if (err) return next(err);
      if (!isMatch) {
        req.flash('error', 'Password Incorrect');
        res.locals.messages = req.flash();
        return res.render('login.html',{ body: req.body });
      }
      // if (!user.isAdmin) {
      //   FX.sendMail(
      //     'login',
      //     email,
      //     {
      //       user: 'Administrator',
      //       time: new Date().toLocaleString(),
      //     },
      //     (err, responseStatus) => {
      //       if (err) return next(err);
      //       if (responseStatus) console.log(responseStatus);
      //     },
      //   );
      // }
      req.session.regenerate(() => {
        req.session.user = primaryContact;
        req.flash('success', 'welcome');
        return res.redirect(`https://contactbook-niajlinpaws.vercel.app/contact/${primaryContact._id}`);
      });
    });
  } catch(err) {
    next(err);
  }
});

// router.get('/forgotPassword', FX.Auth, (req, res) => res.render('forgot_password.html'));	

// router.post('/forgotPassword', FX.Auth, FX.validate(vrules.forgotPassword, 'forgot_password.html'), (req, res, next) => {
//   const password = randomString.generate({
//     length: 6,
//     charset: 'alpha-numeric',
//   });
//   req.body.password = password;	
//   User.findOneAndUpdate(
//     { email: req.body.email },
//     { password: bcrypt.hashSync(req.body.password, bcrypt.genSaltSync(10)),
//   })
//   .then(done => {
//     if (!done) {
//       req.flash('error', 'User Not Found');
//       res.locals.messages = req.flash();
//       return res.render('forgot_password.html');
//     }

//     req.flash('success', 'Your new password sent to your email');
//     res.locals.messages=req.flash();
//     res.render('forgot_password.html',{ display: 'block' });

//     FX.sendMail('forgot_password',
// 	  req.body.email,
//       {
//         user: 'Administrator',
//         password: req.body.password,
// 	  },	
//       (err, responseStatus) => {
//         if (err) return next(err);
//         if (responseStatus) console.log(responseStatus);
// 	  },
//     );
//   })
//   .catch(err => next(err));
// });

module.exports = router;
