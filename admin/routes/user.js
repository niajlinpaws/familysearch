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

router.get('/users/:contactNumber?', FX.Auth, async (req, res, next) => {
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

router.post('/users/find/:contactNumber?', FX.Auth, async (req, res, next) => {
  try {
    const { isAdmin } = req.session.user;
    const { contactNumber } = req.params;
    const { length, start } = req.body;
    const sort = {};
    const search_query = {};
    const search_arr = isAdmin && !contactNumber ? [
    //   'head.name',
  	  'primaryContact.name',
  	  'primaryContact.contactNumber',
  	  'address',
    ]
    : [
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
	let search_value = req.body['search[value]'];
	if (search_value && (!isAdmin || contactNumber)) {
	  query.isApproved = true;
	}
	if (!search_value && (!isAdmin || contactNumber)) {
	  search_value = contactNumber || req.session.user.contactNumber;
	}
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
	    _id: '$primaryContact',
	    head: { $first: '$head' },
	    primaryContact: { $first: '$primaryContact' },
	    address: { $first: '$address' },
	    totalMembers:{ $sum: 1 },
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
	  },
	};
	const project = {
	  $project: isAdmin && !contactNumber ? {
	    _id: '$_id._id',
	    address: 1,
	    // 'head._id': 1,
	    // 'head.name': 1,
	    'primaryContact._id': 1,
	    'primaryContact.name': 1,
	    'primaryContact.contactNumber': 1,
	    totalMembers: 1,
	    totalApprovedMembers: 1,
	    totalUnapprovedMembers: 1,
	  } : {
		_id: 1,
		picture: 1,
		name: 1,
        gender: 1,
        occupation: 1,
		dateOfBirth: { $dateToString: { format: '%d-%m-%Y', date: '$dateOfBirth' } },
		dateOfMarriage: { $dateToString: { format: '%d-%m-%Y', date: '$dateOfMarriage' } },
        contactNumber: 1,
        address: 1,
        'head._id': 1,
	    'head.name': 1,
	    'primaryContact._id': 1,
	    'primaryContact.contactNumber': 1,
		isApproved: 1,
	  },
	};
	const count = {
	  $group: {
	    _id: null,
	    count: { $sum: 1 },
	  },
	};
	const userAggregatePipeline = [];

	if (search_value) {
  	  search_query.$or = [];
  	  search_arr.forEach(field => {
        const obj = {};
	    if (['dateOfBirth', 'dateOfMarriage'].includes(field)) {
          const [day, month, year] = search_value.split(/[\/\-]/);
          const isoDateString = [year, month, day].join('-');

	      if (new Date(isoDateString).getTime()) {
            const startDate = new Date(isoDateString);
            startDate.setUTCHours(0, 0, 0, 0);
            const endDate = new Date(isoDateString);
            endDate.setUTCHours(23, 59, 59, 999);
	        obj.$and = [
              { [field]: { $gte: startDate } },
              { [field]: { $lte: endDate } },
	  	    ];
            search_query.$or.push(obj);
	      }
	    } else {
	      obj[field] = {
            '$regex': field === 'gender' ? `^${search_value}` : search_value,
	       '$options': 'i',
	      };
  	      search_query.$or.push(obj);
	    }
  	  });
	  userAggregatePipeline.push(match, ...lookupAndUnwind, { $match: search_query });
	  if (isAdmin && !contactNumber) {
        userAggregatePipeline.push(group);
	  }
    }

	if (!search_value) {
	  isAdmin && !contactNumber ? userAggregatePipeline.push(match, group)
	    : userAggregatePipeline.push(match);
	}

	const recordsFiltered = (await userAggregate(userAggregatePipeline.concat(count)))[0];

	!search_value ? userAggregatePipeline.push(...lookupAndUnwind, project)
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

router.post('/users/add/:contactNumber?', FX.Auth, FX.validate(vrules.addOrEditUser, 'user.html'), async (req, res, next) => {
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
    const { _id } = await User.create(req.body);
    if (isAdmin) {
      await User.updateOne(
        { _id },
        {
          $set: {
            primaryContact: _id,
            head: _id,
            password: bcrypt.hashSync(basePassword, bcrypt.genSaltSync(10)),
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

router.post('/users/register', FX.validate(vrules.registerPrimaryContactAndUsers), async (req, res, next) => {
  if (!req.body.users.find(user => user.isPrimary && user.contactNumber)) {
	return res.json({ message: 'contactNumber field is required for primary contact user' });
  }
  try {
	let primaryContactId, headId, addressToUpdate;
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
	}) => {
	  const user = {
        isPrimary,
        isHead,
        name,
        gender,
        occupation,
        gotra,
        dateOfBirth,
        dateOfMarriage,
        contactNumber,
      };
	  if ((req.files && Object.keys(req.files).length === 1) && isPrimary) {
	    const { picture } = req.files;
	    const random = FX.randomNumber(6, '');
	    const fileName = random + '-' + picture.name;
	    user.picture = fileName;
	    await picture.mv(path.join(__dirname, '../../public', uploadPath, fileName));
	  }
	  if (isPrimary) {
	    user.password = bcrypt.hashSync(basePassword, bcrypt.genSaltSync(10));
	    addressToUpdate = address;
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
	  },
	);
    res.json({ message: 'User edit successfully' });
  } catch(err) {
    next(err);
  }
});

router.post('/users/edit/commonDetail', FX.validate(vrules.editCommonDetails), async (req, res, next) => {
  try {
	const { head, primaryContact, newHead, newPrimaryContact, address, nativeAddress, email, gotra } = req.body;
	const $set = {	
	  address,
	  nativeAddress,
	  email,
	  gotra,
	};
	const isHeadChanged = newHead && (`${newHead}` !== `${head}`);
	const isPrimaryContactChanged = newPrimaryContact && (`${newPrimaryContact}` !== `${primaryContact}`);
	if(isHeadChanged || isPrimaryContactChanged) {
	  $set.isCommonDetailApproved = false;
	}
    if (req.files && Object.keys(req.files).length === 1) {
      const { picture } = req.files;
      const random = FX.randomNumber(6, '');
      const fileName = random + '-' + picture.name;
      $set.picture = fileName;
      await picture.mv(path.join(__dirname, '../../public', uploadPath, fileName));
    }
	await User.updateMany(
      { primaryContact },
      {
        $set: {
          ...$set,
		  ...(isHeadChanged && { head: newHead }),
          ...(isPrimaryContactChanged && { primaryContact: newPrimaryContact }),
        }
	  },
	);
    res.json({ message: 'Common details updated successfully' });
  } catch(err) {
    next(err);
  }
});

router.get('/users/delete/:id', async (req, res, next) => {
  try {
    await User.updateOne({ _id: new ObjectId(req.params.id) }, { $set:{ isArchive: true } });
	res.status(200).json({ message:`user deleted` });
  } catch(err) {
	next(err);
  }
});

router.get('/users/view/:id', async (req, res, next) => {
  try {
	const user = await User.findById(req.params.id);
	res.status(200).json(user);
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
    await User.updateOne({ _id: new ObjectId(id) }, { $set:{ isApproved } });
    res.status(200).json({ message: `approved changed ${isApproved}` });
  } catch(err) {
	next(err);
  }
});

module.exports = router;
