var app = require("express")();
var http = require("http").Server(app);
var io = require("socket.io")(http);
var Twit = require("twit");
var https = require("https");
var redis = require("redis"),
    client = redis.createClient();
var request = require("request");

var geo = require("georedis").initialize(client);
var cleansedAddress;
var fullurl;
// var locationArray = [];
// var multiPoint = [][];

var crashdb = [];
//   {
//     x: 0,
//     y: 0
//   }
// ];

app.get("/", function(req, res) {
    io.emit("messageFromServer", "I sent this from the server");
    //res.send("hello world");
    // geo.location(cleansedAddress, function(err, location){
    //   if(err) {
    //     console.error(err)
    //   } else {
    //     console.log('Location for Toronto is: ', location.latitude, location.longitude);
    //   }
    // });
    var options = {
        withCoordinates: true, // Will provide coordinates with locations, default false
        withHashes: false, // Will provide a 52bit Geohash Integer, default false
        withDistances: true, // Will provide distance from query, default false
        order: 'ASC', // or 'DESC' or true (same as 'ASC'), default false
        units: 'mi', // or 'km', 'mi', 'ft', default 'm'
        // count: 100, // Number of results to return, default undefined
        accurate: true // Useful if in emulated mode and accuracy is important, default false
    }

    geo.nearby({ latitude: 35.8, longitude: -78.65 }, 50000, options, function(
        err,
        locations
    ) {
        if (err) console.error(err);
        else console.log("returning nearby locationsabc:", locations);
        // locationArray.push(locations);

        geo.locations(locations, function(err, locations) {
            if (err) console.error(err);
            else {
                for (var locationName in locations) {
                    // console.log(
                    //   locationName + "'s location is:",
                    //   locations[locationName].latitude,
                    //   locations[locationName].longitude
                    // );
                    // var date = new Date();
                    // crashdb.push({
                    //     datetime: date,
                    //     location: locationName,
                    //     x: locations[locationName].latitude,
                    //     y: locations[locationName].longitude
                    // });
                    // console.log('crashdb = ', crashdb);
                }
            }
        });
        res.send(locations);
    });
});

io.on("connection", function(socket) {
    console.log("a user connected");
});

http.listen(3000, function() {
    console.log("listening on *:3000");


    // store these in systemd service per
    var twit = new Twit({
        consumer_key: "7lFDwAtmqt7MbQPl0RctMRoV6",
        consumer_secret: "bxFlEGBsDRIHRiKANoCLC6yzAhRSNE6QRzX8wrrEeybdkgKzM9",
        access_token: "7374632-WxCEThennwx9PRU7thAff8Mrmm96ki3CfudkIMKNtZ",
        access_token_secret: "ZkT5mHgKAXHomcjS4ba3hj5impB3QBXOkV2POE1tjkNho",
        timeout_ms: 60 * 1000 // optional HTTP request timeout to apply to all requests.
    });

    // var stream = twit.stream('statuses/filter', {follow: ['7374632', '759251', '20647123','97739866','28785486','1367531','28785486','5695632','14956372','18918698']});
    var stream = twit.stream("statuses/filter", {
        follow: ["7374632", "20647123"]
    });

    stream.on("tweet", tweet => {
        if (
            tweet.retweeted ||
            tweet.retweeted_status ||
            tweet.in_reply_to_status_id ||
            tweet.in_reply_to_user_id ||
            tweet.delete
        ) {
            // skip retweets and replies
            return;
        }
        console.log(`${tweet.user.name} posted: ${tweet.text}`);

        var str = `${tweet.text}`;
        var parsedTweet = str.split("-");

        cleansedAddress = parsedTweet[2].replace(/&amp;/g, "and").trim();
        console.log("cleansedAddress", cleansedAddress);
        const url =
            //   "/arcgis/rest/services/Locators/CompositeLocator/GeocodeServer/findAddressCandidates?SingleLine=&category=&outFields=*&maxLocations=&outSR=4326&searchExtent=&location=&distance=&magicKey=&f=json&Street=" +
            "/arcgis/rest/services/Locators/CompositeLocator/GeocodeServer/findAddressCandidates?&outSR=4326&maxLocations=1&f=json&Street=" +
            cleansedAddress +
            "&City=null&State=null&ZIP=null";
        const url1 =
            //   "/arcgis/rest/services/Locators/CompositeLocator/GeocodeServer/findAddressCandidates?SingleLine=&category=&outFields=*&maxLocations=&outSR=4326&searchExtent=&location=&distance=&magicKey=&f=json&Street=" +
            "https://maps.raleighnc.gov/arcgis/rest/services/Locators/CompositeLocator/GeocodeServer/findAddressCandidates?&outSR=4326&maxLocations=1&f=json&Street=" +
            cleansedAddress +
            "&City=null&State=null&ZIP=null";

        console.log("url1 = ", url1);
        fullurl = encodeURI(url);

        request(url1, function(error, response, body) {
            console.log("error:", error); // Print the error if one occurred
            console.log("statusCode:", response && response.statusCode); // Print the response status code if a response was received
            console.log("body:", body); // Print the HTML for the Google homepage.
            var parsed = JSON.parse(body);
            this.coords = parsed.candidates[0].location;
            console.log("parsed = ", parsed.candidates[0].location);
            geo.addLocation(
                cleansedAddress, { latitude: this.coords.y, longitude: this.coords.x },
                function(err, reply) {
                    if (err) console.error(err);
                    else console.log("added location:", reply);
                }
            );

            io.emit("messageFromServer", this.coords);
            io.emit("crashLocation", cleansedAddress);
        });
    });
    // https.get(
    //   {
    //     host: "maps.raleighnc.gov",
    //     path: cleansedAddress
    //   },
    //   function(response) {
    //     // Continuously update stream with data
    //     var body = "";
    //     response.on("data", function(d) {
    //       body += d;
    //     });
    //     response.on("end", function() {
    //       // Data reception is done, do whatever withN it!
    //       var parsed = JSON.parse(body);
    //       // console.log('parsed full', parsed);
    //       this.coords = parsed.candidates[0].location;
    //       console.log("parsed = ", parsed.candidates[0].location);

    //       geo.addLocation(cleansedAddress, {latitude:  this.coords.y, longitude:  this.coords.x}, function(err, reply){
    //         if(err) console.error(err)
    //         else console.log('added location:', reply)
    //       })
    //     //   io.emit(this.coords, { for: "everyone" });
    //     io.emit("messageFromServer", this.coords);

    //     });
    //   }
    // );
    // });
});