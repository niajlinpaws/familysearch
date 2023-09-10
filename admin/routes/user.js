const express = require('express');
const { model, Types: { ObjectId } } = require('mongoose');
const path = require('path');
const bcrypt = require('bcrypt');

const FX = require('../../utils/functions');
const vrules = require('../../validation');
const { uploadPath, basePassword } = require('../../config/constants');

const router = express.Router();
const User = model('User');

const csv = {};

router.get('/sign-s3',(req,res,next)=>{
	var {file,type}=req.query;
	//console.log("file==========>",file,"query========>",req.query);
	var params={
		Bucket:'clickapp',
	    Key: file,
	    Expires: 25000,
	    ContentType: type,
	    ACL: 'public-read'
	}
	FX.getSignedUrl('putObject',params).then((data)=>{

		//console.log("url====================>",data.url);
		res.status(200).json({data:data});
	});
});

router.post('/delete-s3Object',(req,res,next)=>{
	var {file}=req.body;
	var params={
		Bucket:'clickapp',
	    Key: file
	}
	FX.deleteObject(params).then((data)=>{
		//console.log("file============>",file);
		res.status(200).json({data:data});
	});
});

router.get('/users/csv',FX.adminAuth,(req,res,next)=>{
	User.find({isArchive:false},{_id:0,firstName:1,email:1,countryCode:1,mobile:1,location:1,website:1,description:1,created:1},(err,result)=>{
		if(err)return next(err);
		let columns={firstName:"Business Name",description:"Description",email:"Email",countryCode:"Country Code",mobile:"Mobile Number",
		location:"Location",website:"Website",created:"Created At"};

		csv.stringify(result,{header:true,columns:columns},(err,output)=>{
			res.json(output);
		});
	});
});

router.get('/users', FX.Auth, async (req, res, next) => {
  try {
    const users = await User.find({
  	  isArchive: false,
  	  isAdmin: false,
	  $or: [
		{ primaryContact: req.session.user._id },
		{ _id: req.session.user._id },
	  ],
    });
	res.render('user.html', { users });
  } catch(err) {
	next(err);
  }
});

router.get('/users/gotra', FX.Auth, async (req, res, next) => res.render('userByGotra.html'));

router.post('/users/find', async (req, res, next) => {
  try {
    const { isAdmin } = req.session.user || {};
    const { contactNumber = '' } = req.params || {};
    const { length = 0, start = 0, fromDate, toDate } = req.body;
	const searchFields = req.body.searchFields ? req.body.searchFields.split(',') : [];
    const sort = {};
    const search_query = {};
    const search_arr = searchFields.length
	? searchFields
	// isAdmin && !contactNumber ? [
    //   'head.name',
  	//   'primaryContact.name',
  	//   'primaryContact.contactNumber',
  	//   'address',
    // ]
    // : 
	: [
	  'name',
      'gender',
      'occupation',
      'dateOfBirth',
      'dateOfMarriage',
      'contactNumber',
      'address',
	  'nativeAddress',
	  'email',
	  'gotra',
      'head.name',
      'head.contactNumber',
	  'head.occupation',
      'primaryContact.name',
      'primaryContact.contactNumber',
	  'primaryContact.occupation',
    ];
    const sort_arr = isAdmin && !contactNumber ? [
  	  'primaryContact.contactNumber',
  	//   'head.name',
  	  'primaryContact.name',
  	  'primaryContact.contactNumber',
  	  'address',
  	  'totalMembers',
    ]
    : [
      'primaryContact.contactNumber',
	  'picture',
      'name',
      'gender',
      'occupation',
      'dateOfBirth',
      'dateOfMarriage',
      'contactNumber',
      'address',
      'head.name',
      'primaryContact.contactNumber',
    ];
    const query = { isArchive: false, isAdmin: false };
	if (!isAdmin) {
	  query['previousData.isApprovedAfterRegistration'] = true;
	}
	let search_value = req.body['search[value]'];
	// if (search_value && (!isAdmin || contactNumber)) {
	//   query.isApproved = true;
	// }
	if (!search_value && (!isAdmin || contactNumber)) {
	  search_value = contactNumber;
	}
    const sort_key = sort_arr[parseInt(req.body['order[0][column]'])];
    const sort_val = req.body['order[0][dir]'] === 'asc' ? 1: -1;
    const limit = parseInt(length) > 0 ? parseInt(length): '';
    sort[sort_key] = sort_val;

	const equalToCondition = (condition, onTrue, onFalse) => ({ $cond: [{ $eq: [condition, true] }, onTrue, onFalse] });
	const commonDetailsApprovalCheck = key => ['$isCommonDetailsApproved', `$${key}`, `$previousData.${key}`];
	const approvalCheck = key => ['$isApproved', `$${key}`, `$previousData.${key}`];
	const userAggregate = userAggregatePipeline => User.aggregate(userAggregatePipeline);
	const match = { $match: query };
	const lookupAndUnwind = [
	  {
		$lookup: {
		  from: 'users',
		  localField: 'primaryContact',
		  foreignField: '_id',
		  as: 'primaryContact',
		},
	  },
	  { $unwind: '$primaryContact' },
	  {
		$lookup: {
		  from: 'users',
		  localField: 'head',
		  foreignField: '_id',
		  as: 'head',
		},
	  },
	  { $unwind: '$head' },
	];
	const group = {
      $group: {
        _id: '$primaryContact',
        head: { $first: isAdmin ? equalToCondition(...commonDetailsApprovalCheck('head')) : '$head' },
        primaryContact: { $first: isAdmin ? equalToCondition(...commonDetailsApprovalCheck('primaryContact')) : '$primaryContact' },
        address: { $first: isAdmin ? equalToCondition(...commonDetailsApprovalCheck('address')) : '$address' },
        nativeAddress: { $first: isAdmin ? equalToCondition(...commonDetailsApprovalCheck('nativeAddress')) : '$nativeAddress' },
        email: { $first: isAdmin ? equalToCondition(...commonDetailsApprovalCheck('email')) : '$email' },
        gotra: { $first: isAdmin ? equalToCondition(...commonDetailsApprovalCheck('gotra')) : '$gotra' },
        picture: { $first: isAdmin ? equalToCondition(...commonDetailsApprovalCheck('picture')) : '$picture' },
        totalMembers:{ $sum: 1 },
        isCommonDetailsApproved: { $first: '$isCommonDetailsApproved' },
        totalApprovedMembers: {
          $sum: {
            $cond: [{ $eq: ['$isApproved', true] }, 1, 0],
          },
        },
        totalUnapprovedMembers: {
          $sum: {
            $cond: [{ $eq: ['$isApproved', false] }, 1, 0],
          },
        },
        users: {
          $push: {
            _id: '$_id',
            name: isAdmin ? equalToCondition(...approvalCheck('name')) : '$name',
            gender: isAdmin ? equalToCondition(...approvalCheck('gender')) : '$gender',
            occupation: isAdmin ? equalToCondition(...approvalCheck('occupation')) : '$occupation',
            contactNumber: isAdmin ? equalToCondition(...approvalCheck('contactNumber')) : '$contactNumber',
            dateOfBirth: { $dateToString: { format: '%d-%m-%Y', date: isAdmin ? equalToCondition(...approvalCheck('dateOfBirth')) : '$dateOfBirth' } },
            dateOfMarriage: { $dateToString: { format: '%d-%m-%Y', date: isAdmin ? equalToCondition(...approvalCheck('dateOfMarriage')) : '$dateOfMarriage' } },
            isApproved: '$isApproved',
          },
        },
	  },
	};
	const project = {
	  $project: 
	//   isAdmin && !contactNumber ? 
	  {
	    _id: 1,
	    address: 1,
	    'head._id': 1,
	    'head.name': 1,
	    'head.gender': 1,
	    'primaryContact._id': 1,
	    'primaryContact.name': 1,
	    'primaryContact.contactNumber': 1,
	    'primaryContact.gender': 1,
	    totalMembers: 1,
	    totalApprovedMembers: 1,
	    totalUnapprovedMembers: 1,
        gotra: 1,
        nativeAddress: 1,
        email: 1,
		picture: 1,
		isCommonDetailsApproved: 1,
		users: 1,
	  },
	//   : {
	// 	_id: 1,
	// 	picture: 1,
	// 	name: 1,
    //     gender: 1,
    //     occupation: 1,
	// 	dateOfBirth: { $dateToString: { format: '%d-%m-%Y', date: '$dateOfBirth' } },
	// 	dateOfMarriage: { $dateToString: { format: '%d-%m-%Y', date: '$dateOfMarriage' } },
    //     contactNumber: 1,
    //     address: 1,
    //     'head._id': 1,
	//     'head.name': 1,
	//     'primaryContact._id': 1,
	//     'primaryContact.contactNumber': 1,
	// 	isApproved: 1,
	//   },
	};
	const count = {
	  $group: {
	    _id: null,
	    count: { $sum: 1 },
	  },
	};
	const userAggregatePipeline = [];

	if (search_value || fromDate || toDate) {
  	  search_query.$or = [];
  	  search_arr.forEach(field => {
        const obj = {};
	    if (['dateOfBirth', 'dateOfMarriage'].includes(field) && (search_value || fromDate || toDate)) {
          const convertToISODateString = date => {
            const [day, month, year] = date.split(/[\/\-]/);
            return [year, month, day].join('-');
          };
          let isoDateString, fromISODateString, toISODateString;
          if (search_value) {
            isoDateString = convertToISODateString(search_value);
          }
          if (fromDate) {
            fromISODateString = convertToISODateString(fromDate);
          }
          if (toDate) {
            toISODateString = convertToISODateString(toDate);
          }
	      if (new Date(isoDateString || fromISODateString || toISODateString).getTime()) {
            const startDate = new Date(isoDateString || fromISODateString || toISODateString);
            startDate.setUTCHours(0, 0, 0, 0);
            const endDate = new Date(isoDateString || toISODateString || fromISODateString);
            endDate.setUTCHours(23, 59, 59, 999);
	        obj.$and = [
              { [field]: { $gte: startDate } },
              { [field]: { $lte: endDate } },
	  	    ];
            search_query.$or.push(obj);
	      }
	    } else {
	      obj[field] = {
           '$regex': field === 'gender' ? `^${(search_value || fromDate || toDate)}` : (search_value || fromDate || toDate),
	       '$options': 'i',
	      };
  	      search_query.$or.push(obj);
	    }
  	  });
	  userAggregatePipeline.push(match, ...lookupAndUnwind, { $match: search_query }, group);
    }

	if (!(search_value || fromDate || toDate)) {
	  userAggregatePipeline.push(match, group);
	//   isAdmin && !contactNumber ? userAggregatePipeline.push(match, group)
	//     : userAggregatePipeline.push(match);
	}

	const recordsFiltered = (await userAggregate(userAggregatePipeline.concat(count)))[0];

	!(search_value || fromDate || toDate) ? userAggregatePipeline.push(...lookupAndUnwind, project)
      : userAggregatePipeline.push(project);

	const data = await userAggregate(userAggregatePipeline)
	  .sort(sort)
	  .skip(parseInt(start))
	  .limit(limit || recordsFiltered && recordsFiltered.count || 1);
	res.json({
	  recordsFiltered: recordsFiltered && recordsFiltered.count,
	  recordsTotal: data.length,
	  data,
	});
  }
  catch(err) {
	next(err);
  }
});

router.post('/users/find/gotra/:gotra?', async (req, res, next) => {
  try {
    const { gotra } = req.params || {};
    const { length = 0, start = 0, fromDate, toDate } = req.body;
	const searchFields = req.body.searchFields ? req.body.searchFields.split(',') : [];
    const sort = {};
    const search_query = {};
    const search_arr = searchFields.length
	  ? searchFields
	  : [
      'name',
      'gender',
      'occupation',
      'dateOfBirth',
      'dateOfMarriage',
      'contactNumber',
      'address',
	  'nativeAddress',
	  'email',
	  'gotra',
      'head.name',
      'head.contactNumber',
	  'head.occupation',
      'primaryContact.name',
      'primaryContact.contactNumber',
	  'primaryContact.occupation',
    ];
    const sort_arr = gotra ? [
	  'name',
	  'gender',
	  'occupation',
	  'dateOfBirth',
	  'dateOfMarriage',
	  'contactNumber',
	  'primaryContact.name',
	  'primaryContact.contactNumber',
	  'head.name',
	  'address',
	  'nativeAddress',
	  'email',
	]
	:[
  	  '_id',
  	  '_id',
  	  'totalMembers',
    ];
    const query = { isArchive: false, isAdmin: false };
	if (gotra) {
	  query.gotra = gotra;
	}
	let search_value = req.body['search[value]'];

    const sort_key = sort_arr[parseInt(req.body['order[0][column]'])];
    const sort_val = req.body['order[0][dir]'] === 'asc' ? 1: -1;
    const limit = parseInt(length) > 0 ? parseInt(length): '';
    sort[sort_key] = sort_val;

	const userAggregate = userAggregatePipeline => User.aggregate(userAggregatePipeline);
	const match = { $match: query };
	const lookupAndUnwind = [
	  {
		$lookup: {
		  from: 'users',
		  localField: 'primaryContact',
		  foreignField: '_id',
		  as: 'primaryContact',
		},
	  },
	  { $unwind: '$primaryContact' },
	  {
		$lookup: {
		  from: 'users',
		  localField: 'head',
		  foreignField: '_id',
		  as: 'head',
		},
	  },
	  { $unwind: '$head' },
	];
	const group = {
      $group: {
        _id: '$gotra',
        totalMembers:{ $sum: 1 },
        // users: {
        //   $push: {
        //     _id: '$_id',
		// 	head: {
		// 	  _id: '$head._id',
		// 	  name: '$head.name',
		// 	},
		// 	primaryContact: {
		// 	  _id: '$primaryContact._id',
		// 	  name: '$primaryContact.name',
		// 	  contactNumber: '$primaryContact.contactNumber',
		// 	},
		// 	address: '$address',
        //     nativeAddress: '$nativeAddress',
        //     email: '$email',
        //     name: '$name',
        //     gender: '$gender',
        //     occupation: '$occupation',
        //     contactNumber: '$contactNumber',
        //     dateOfBirth: { $dateToString: { format: '%d-%m-%Y', date: '$dateOfBirth' } },
        //     dateOfMarriage: { $dateToString: { format: '%d-%m-%Y', date: '$dateOfMarriage' } },
        //     isApproved: '$isApproved',
        //   },
        // },
	  },
	};
	const project = {
	  $project: gotra ? {
		_id: 1,
		'head._id': 1,
		'head.name': 1,
		'primaryContact._id': 1,
		'primaryContact.name': 1,
		'primaryContact.contactNumber': 1,
		address: 1,
		nativeAddress: 1,
        email: 1,
        name: 1,
        gender: 1,
        occupation: 1,
        contactNumber: 1,
        dateOfBirth: { $dateToString: { format: '%d-%m-%Y', date: '$dateOfBirth' } },
        dateOfMarriage: { $dateToString: { format: '%d-%m-%Y', date: '$dateOfMarriage' } },
        isApproved: 1,
	  }
	  : {
	    _id: 1,
	    // gotra: 1,
	    totalMembers: 1,
		// users: 1,
	  },
	};
	const count = {
	  $group: {
	    _id: null,
	    count: { $sum: 1 },
	  },
	};
	const userAggregatePipeline = [];

	if (search_value || fromDate || toDate) {
  	  search_query.$or = [];
  	  search_arr.forEach(field => {
        const obj = {};
	    if (['dateOfBirth', 'dateOfMarriage'].includes(field) && (search_value || fromDate || toDate)) {
		  const convertToISODateString = date => {
            const [day, month, year] = date.split(/[\/\-]/);
            return [year, month, day].join('-');
		  };
		  let isoDateString, fromISODateString, toISODateString;
          if (search_value) {
            isoDateString = convertToISODateString(search_value);
		  }
		  if (fromDate) {
            fromISODateString = convertToISODateString(fromDate);
		  }
		  if (toDate) {
            toISODateString = convertToISODateString(toDate);
		  }
	      if (new Date(isoDateString || fromISODateString || toISODateString).getTime()) {
            const startDate = new Date(isoDateString || fromISODateString || toISODateString);
            startDate.setUTCHours(0, 0, 0, 0);
            const endDate = new Date(isoDateString || toISODateString || fromISODateString);
            endDate.setUTCHours(23, 59, 59, 999);
	        obj.$and = [
              { [field]: { $gte: startDate } },
              { [field]: { $lte: endDate } },
	  	    ];
            search_query.$or.push(obj);
	      }
	    } else {
	      obj[field] = {
            '$regex': field === 'gender' ? `^${(search_value || fromDate || toDate)}` : (search_value || fromDate || toDate),
	       '$options': 'i',
	      };
  	      search_query.$or.push(obj);
	    }
  	  });
	  userAggregatePipeline.push(match, ...lookupAndUnwind, { $match: search_query });
	  if (!gotra) {
		userAggregatePipeline.push(group);
	  }
    }

	if (!(search_value || fromDate || toDate)) {
	  userAggregatePipeline.push(match, ...lookupAndUnwind);
	  if (!gotra) {
        userAggregatePipeline.push(group);
	  }
	}

	const recordsFiltered = (await userAggregate(userAggregatePipeline.concat(count)))[0];

	userAggregatePipeline.push(project);

	const data = await userAggregate(userAggregatePipeline)
	  .sort(sort)
	  .skip(parseInt(start))
	  .limit(limit || recordsFiltered && recordsFiltered.count || 1);
	res.json({
	  recordsFiltered: recordsFiltered && recordsFiltered.count,
	  recordsTotal: data.length,
	  data,
	});
  }
  catch(err) {
	next(err);
  }
});

router.post('/users/check', async (req, res, next) => {
  try {
	const element = FX.capitalize([Object.keys(req.body)[0]]);
	req.body.isArchive = false;
	req.body.isAdmin = false;
	let user;
	if (req.body.contactNumber) {
	  const aggregateCount = (await User.aggregate(
        [
          {
            $match:  {
              isArchive: false,
              isAdmin: false,
            },
          },
          {
            $lookup: {
              from: 'users',
              localField: 'primaryContact',
              foreignField: '_id',
              as: 'primaryContact'
            },
          },
          { $unwind: '$primaryContact' },
          { $match: { 'primaryContact.contactNumber': req.body.contactNumber } },
		  { $count: "totalPrimaryContactNumber" },
		],
	  ))[0];
	  user = aggregateCount && aggregateCount.totalPrimaryContactNumber;
	} else {
	  user = await User.count(req.body);
	}
    if (user) return res.json({ message: `${element[0]} Already Exist` });
    res.json(`${element[0]} Not Found`);
  } catch(err) {
    next(err);
  }
});

router.post('/users/add', FX.Auth, FX.validate(vrules.addOrEditUser, 'user.html'), async (req, res, next) => {
  try {
    const { isAdmin, primaryContact } = req.session.user;
    if (!isAdmin) {
      req.body.primaryContact = primaryContact;
    }
    if (req.files && Object.keys(req.files).length === 1) {
      const { picture } = req.files;
      const random = FX.randomNumber(6, '');
      const fileName = random + '-' + picture.name;
      req.body.picture = fileName;
      await picture.mv(path.join(__dirname, '../../public', uploadPath, fileName));
    }
    const { _id, email, dateOfBirth } = await User.create(req.body);
    if (isAdmin) {
	  const [, month, day] = new Date(dateOfBirth).toISOString().slice(0, 10).split('-');
	  const password = email.slice(0, 1).toUpperCase() + email.slice(1, 4) + day + month + '#';
      await User.updateOne(
        { _id },
        {
          $set: {
            primaryContact: _id,
            head: _id,
            password: bcrypt.hashSync(password, bcrypt.genSaltSync(10)),
            isApproved: true,
          },
        },
      );
    }
    res.redirect('/admin/users');
  } catch(err) {
    next(err);
  }
});

router.post('/users/add/data', FX.validate(vrules.addOrEditUser), async (req, res, next) => {
  try {
    const { primaryContact, dateOfBirth } = req.body;
    const user = await User.findById(primaryContact);
	if (!user) return res.json({ message: 'Primary contact not found' });
	const [, month, day] = new Date(dateOfBirth).toISOString().slice(0, 10).split('-');
	const password = user.email.slice(0, 1).toUpperCase() + user.email.slice(1, 4) + day + month + '#';
    await User.create({
	  ...req.body,
	  primaryContact,
	  head: user.head,
	  address: user.address,
	  gotra: user.gotra,
      nativeAddress: user.nativeAddress,
      email: user.email,
	  password: bcrypt.hashSync(password, bcrypt.genSaltSync(10)),
	  isApproved: false,
	  isCommonDetailApproved: false,
	  previousData: {
		isApprovedAfterRegistration: false,
		primaryContact,
		head: user.head,
		address: user.address,
		nativeAddress: user.nativeAddress,
		email: user.email,
		gotra: user.gotra,
	  },
	});
    res.json({ message: 'User added successfully' });
  } catch(err) {
    next(err);
  }
});

router.post('/users/register', FX.validate(vrules.registerPrimaryContactAndUsers), async (req, res, next) => {
  if (!req.body.users.find(user => user.isPrimary && user.contactNumber)) {
	return res.json({ message: 'contactNumber field is required for primary contact user' });
  }
  try {
	let primaryContactId, headId, addressToUpdate, nativeAddressToUpdate, emailToUpdate, gotraToUpdate;
	const idsToUpdate = [];
	await Promise.all(req.body.users.map(async ({
	  isPrimary,
	  isHead,
	  name,
	  gender,
	  occupation,
	  gotra,
	  dateOfBirth,
	  dateOfMarriage,
	  contactNumber,
	  address,
	  nativeAddress,
	  email,
	}) => {
	  const user = {
        isPrimary,
        isHead,
        name,
        gender,
        occupation,
        gotra: gotra.toUpperCase(),
        dateOfBirth,
        dateOfMarriage,
        contactNumber,
		address,
		nativeAddress,
		email,
      };
	  if ((req.files && Object.keys(req.files).length === 1) && isPrimary) {
	    const { picture } = req.files;
	    const random = FX.randomNumber(6, '');
	    const fileName = random + '-' + picture.name;
	    user.picture = fileName;
	    await picture.mv(path.join(__dirname, '../../public', uploadPath, fileName));
	  }
	  if (isPrimary) {
		const [, month, day] = new Date(user.dateOfBirth).toISOString().slice(0, 10).split('-');
		const password = user.email.slice(0, 1).toUpperCase() + user.email.slice(1, 4) + day + month + '#';
	    user.password = bcrypt.hashSync(password, bcrypt.genSaltSync(10));
	    addressToUpdate = user.address;
		nativeAddressToUpdate = user.nativeAddress;
		emailToUpdate = user.email;
		gotraToUpdate = user.gotra;
	  }
	  const { _id } = await User.create(user);
	  idsToUpdate.push(_id);
	  if (isPrimary) {
	    primaryContactId = _id;
	  }
	  if (isHead) {
	    headId = _id;
	  }
	}));
    if (primaryContactId || headId) {
      await User.updateMany(
	    { _id: idsToUpdate },
	    {
	      $set: {
	        primaryContact: primaryContactId,
	        head: headId || primaryContactId,
			address: addressToUpdate,
			nativeAddress: nativeAddressToUpdate,
			email: emailToUpdate,
			gotra: gotraToUpdate,
			previousData: {
              isApprovedAfterRegistration: false,
			  primaryContact: primaryContactId,
	          head: headId || primaryContactId,
			  address: addressToUpdate,
			  nativeAddress: nativeAddressToUpdate,
			  email: emailToUpdate,
			  gotra: gotraToUpdate,
			},
          },
        },
      );
    }
	const users = (await User.find({ _id: idsToUpdate }).lean()).map(user => {
	  const userId = `${user._id}`;
	  if (userId === `${primaryContactId}`) {
	    user.isPrimary = true;
	  }
	  if (userId === `${headId}`) {
	    user.isHead = true;
	  }
	  return user;
	});
    res.json({ users });
  } catch(err) {
    next(err);
  }
});

router.post('/users/edit', FX.Auth, FX.validate(vrules.addOrEditUser, 'user.html'), async (req, res, next) => {
  try {
	const { id, head, address } = req.body;
    req.body.isApproved = false;
    if (req.files && Object.keys(req.files).length === 1) {
      const { picture } = req.files;
      const random = FX.randomNumber(6, '');
      const fileName = random + '-' + picture.name;
      req.body.picture = fileName;
      await picture.mv(path.join(__dirname, '../../public', uploadPath, fileName));
    }
    const { primaryContact } = await User.findByIdAndUpdate(id, req.body);
	await User.updateMany({ primaryContact }, { $set: { head, address } });
    res.redirect('/admin/users');
  } catch(err) {
    next(err);
  }
});

router.post('/users/edit/data', FX.validate(vrules.addOrEditUser), async (req, res, next) => {
  try {
	const {
	  id,
	  name,
      gender,
      occupation,
      dateOfBirth,
      dateOfMarriage,
      contactNumber,
	} = req.body;
	const user = await User.findById(id);
    await User.updateOne(
	  { _id: ObjectId(id) },
	  {
	    id,
	    name,
	    gender,
	    occupation,
	    dateOfBirth,
	    dateOfMarriage,
	    contactNumber,
		isApproved: false,
		previousData: {
		  ...user.previousData,
		  name: user.name,
          gender: user.gender,
          occupation: user.occupation,
          dateOfBirth: user.dateOfBirth,
          dateOfMarriage: user.dateOfMarriage,
          contactNumber: user.contactNumber,
		},
	  },
	);
    res.json({ message: 'User edit successfully' });
  } catch(err) {
    next(err);
  }
});

router.post('/users/edit/commonDetail', FX.validate(vrules.editCommonDetails), async (req, res, next) => {
  try {
	const { head, primaryContact, address, nativeAddress, email, gotra } = req.body;
	const $set = {
	  head,
	  primaryContact,
	  address,
	  nativeAddress,
	  email,
	  gotra: gotra.toUpperCase(),
	  isCommonDetailApproved: false,
	};
    if (req.files && Object.keys(req.files).length === 1) {
      const { picture } = req.files;
      const random = FX.randomNumber(6, '');
      const fileName = random + '-' + picture.name;
      $set.picture = fileName;
      await picture.mv(path.join(__dirname, '../../public', uploadPath, fileName));
    }
	const user = await User.findById(primaryContact);
	await User.updateMany(
      { primaryContact },
      {
        $set: {
          ...$set,
		  previousData: {
			...user.previousData,
            head: user.head,
	        primaryContact: user.primaryContact,
	        address: user.address,
	        nativeAddress: user.nativeAddress,
	        email: user.email,
	        gotra: user.gotra,
			picture: user.picture,
		  },
        },
	  },
	);
    res.json({ message: 'Common details updated successfully' });
  } catch(err) {
    next(err);
  }
});

router.get('/users/delete/:id', async (req, res, next) => {
  try {
	const { isAdmin } = req.session.user;
    await User.updateOne(
	  { _id: new ObjectId(req.params.id) },
      { $set:{ [isAdmin ? 'isArchive' : 'isApproved']: true } },
	);
	res.status(200).json({ message:`user deleted` });
  } catch(err) {
	next(err);
  }
});

router.get('/users/view/:id', async (req, res, next) => {
  try {
	let userData = await User.findById(req.params.id);
	if (req.query.includeFamilyMembers === 'true') {
	  userData = {
	    users: (await User.find({
		  primaryContact: userData.primaryContact,
		  isArchive: false,
		  isAdmin: false,
		}).lean()).map(user => {
            const userId = `${user._id}`;
            if (userId === `${(user.isApproved || user.isCommonDetailApproved) ? user.primaryContact : user.previousData.primaryContact}`) {
              user.isPrimary = true;
            }
            if (userId === `${(user.isApproved || user.isCommonDetailApproved) ? user.head: user.previousData.head}`) {
              user.isHead = true;
            }
            return { ...user, ...user.previousData };
        }),
	  };
	}
	res.status(200).json(userData);
  } catch(err) {
	next(err);
  }
});

router.post('/users/adminNotify/:id',FX.adminAuth,function(req,res,next){
	(req.body.isAdminNotified === 'false')?
	User.findByIdAndUpdate(req.params.id,{$set:{isAdminNotified:true}},function(err,result){
		if(err)return next(err);
		res.json({message:"done"});
	})
	:
	res.json({message:"already notified"});
});

router.post('/users/approve', FX.Auth, FX.validate(vrules.approveUser, 'user.html'), async (req, res, next) => {
  try {
    const { id, isApproved } = req.body;
    await User.updateOne({ _id: new ObjectId(id) }, { $set:{ isApproved, 'previousData.isApprovedAfterRegistration': true } });
    res.status(200).json({ message: `approved changed ${isApproved}` });
  } catch(err) {
	next(err);
  }
});

module.exports = router;
