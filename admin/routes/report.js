const express = require('express');

const FX = require('../../utils/functions');

const router = express.Router();

router.get('/reports',FX.adminAuth, (req, res, next)=>{
	res.render('report.html');
});

router.post('/reports/find',FX.adminAuth,(req,res,next)=>{
	//console.log("req.body=====================>",req.body);
	var {length,start}=req.body;
	var sort={};
	search_arr=["eventName","description","eventStartDateTime","eventEndDateTime"];
	sort_arr=["_id","eventName","description","eventStartDateTime","eventEndDateTime","reportCount","favCount","goingCount"];
	query={ isArchive:false , "reportBy.0":{$exists:true} }

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

	Event.count(query)
	.exec((err,result1)=>{
		if(err)return next(err);
		Event.aggregate(
		[   {$match:query},
			{$project:
				{
					created:1,
					eventName:1,
					description:1,
					eventStartDateTime:1,
					eventEndDateTime:1,
					reportCount:{$size:"$reportBy"},
					favCount:{$size:"$favBy"},
					goingCount:{$size:"$goingUser"},
					status:1,
					user:1
				}
			}
		])
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

module.exports = router;
