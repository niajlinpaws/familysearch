const express = require('express');

const FX = require('../../utils/functions');

const router = express.Router();

router.get('/requests',FX.adminAuth, (req, res, next)=>{
	res.render('request.html');
});

router.post('/requests/find',FX.adminAuth,(req,res,next)=>{
	//console.log("req.body=====================>",req.body);
	var {length,start}=req.body;
	var sort={};
	search_arr=["subject","description"];
	sort_arr=["_id","subject","description","created"];
	query={ isArchive:false }

	var sort_key=sort_arr[parseInt(req.body["order[0][column]"])];
	var sort_val=req.body["order[0][dir]"]=="asc"?1:-1;
	sort[sort_key]=sort_val;
	//console.log("sort======>",sort);
	var limit=parseInt(length)>0?parseInt(length):'';

	if(req.body['search[value]'])
	{
		query["$or"]=[];
		search_arr.forEach(function(field){
			var obj={};
			obj[field] =
			{
		   	     '$regex': req.body['search[value]'],
		        '$options': 'i'
		    } 
			query["$or"].push(obj);
		});
	}

	Inquiry.count(query)
	.exec((err,result1)=>{
		if(err)return next(err);
		Inquiry.find(query)
		.sort(sort)
		.skip(parseInt(start))
		.limit(limit)
		.exec((err,result)=>{
			if(err)return next(err);
			User.populate(result,{path:"user", select:"firstName email"},(err,result)=>{
				if(err)return next(err);
				res.json({recordsFiltered:result1,recordsTotal:result.length,data:result});
			});
		});
	});
});

router.get('/requests/delete/:id',FX.adminAuth,function(req,res,next){
	Inquiry.findByIdAndUpdate(req.params.id,{$set:{isArchive:true}},function(err,result){
		if(err)return next(err);
		if(result)
		res.status(200).json({message:`inquiry deleted`});
	});
});

router.post('/requests/resolve',FX.adminAuth,function(req,res,next){
	var {id,status}=req.body;
	Inquiry.findByIdAndUpdate(id,{$set:{isResolved:status}},function(err,result){
		if(err)return next(err);
		if(result)
		res.status(200).json({message:`resolve status changed ${status}`});
	});
});

module.exports = router;
