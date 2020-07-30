if(!(process.argv[2]&&process.argv[3]&&process.argv[4]&&process.argv[5])) {

	console.log("Please pass in the following variables: SID, Auth, Start Date (YYYY-MM-DD), End Date (YYYY-MM-DD)");
	process.exit(1);

}

var rp = require('request-promise');
var fs = require('fs');
var async = require('async');
var moment = require('moment-timezone');
var Promise = require('bluebird');
var async = require('async');


if(process.argv[8] == 'utc') {
	var startDate = moment(process.argv[4], 'YYYY-MM-DD','UTC').tz('America/New_York');
	var endDate = moment(process.argv[5], 'YYYY-MM-DD').tz('America/New_York');
} else {
	var startDate = moment(process.argv[4], 'YYYY-MM-DD','UTC');
	var endDate = moment(process.argv[5], 'YYYY-MM-DD');
}


var sid = process.argv[2];
var auth = process.argv[3];

var stream = fs.createWriteStream('SMS log for ' + sid + ' from ' + startDate.format('YYYY-MM-DD')+' to ' + endDate.format('YYYY-MM-DD') + '.csv');
stream.write('Account SID,From,To,Num Media,Num Segments,Price,Price Unit,Date Created,Date Sent,Status,Direction\n');

if(process.argv[6]) {
	var concurrency = process.argv[6];
} else {
	var concurrency = 25;
}

if(process.argv[7]) {
	var timeSlot = process.argv[7];
} else {
	var timeSlot = 120;
}

var q = async.queue(function(task,callback){

	if(task.next_page_uri) {
		var uri = 'https://api.twilio.com' + task.next_page_uri;
	} else {
		var uri = 'https://api.twilio.com/2010-04-01/Accounts/' + sid + '/Messages.json?PageSize=1000&DateSent>=' + task.start + '&DateSent<=' + task.end;
	}

	console.log('Pulling ' + task.start);

	options = {
		json: true,
		uri: uri,
		method: 'GET',
		auth: {
			user: sid,
			pass: auth
		}
	}

	rp(options)
	.then(function(response){

		async.forEachOf(response.messages, function(item,key){

			stream.write(sid+','+item.from+','+item.to+','+item.num_media+','+item.num_segments+','+item.price+','+item.price_unit+','+moment(item.date_created).format('YYYY-MM-DD hh:mm:ss')+','+moment(item.date_sent).format('YYYY-MM-DD hh:mm:ss')+','+item.status+','+item.direction+'\n');

		});

		if(response.next_page_uri){
			q.push({next_page_uri: response.next_page_uri});
		}

		callback();

	})
	.catch(function(err){
		console.log(err);
		if(!task.retries){
			task.retries=1;
			q.push(task);
		}
		 else if (task.retries<5){
			task.retries++;
			q.push(task);
		} else {
			errorList.push([task,'Maximum retries exceeded!']);
		}

		callback();
	});

},concurrency);

q.drain = function(){
	console.log('All messages pulled');
	if(errorList.length>0){
		console.log('Errors:\n',errorList);
	}

}

var dates=[];
for(i = 0; startDate.isBefore(endDate); i++) {

	dates.push({
		start: startDate.utc('2015-01-22T16:11:36.36-07:00').format(),
		end: startDate.add(timeSlot,'m').utc('2015-01-22T16:11:36.36-07:00').format()
	});

}

console.log({
		start: startDate.utc('2015-01-22T16:11:36.36-07:00').format(),
		end: startDate.add(timeSlot,'m').utc('2015-01-22T16:11:36.36-07:00').format()
	});

var errorList = [];

console.log('Dates assembled, pulling data.')
q.push(dates);