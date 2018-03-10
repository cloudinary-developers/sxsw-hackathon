const cloudinary = require('cloudinary');
const express    = require('express');
const Webtask    = require('webtask-tools');
const bodyParser = require('body-parser');
const request = require('request');
const parsePath = require('parse-filepath');




var app = express();

var musicmatch_api_key, api, artists, tracks, releases , consumerkey, consumersecret;

app.use(bodyParser.json());

// Our Middleware to setup API 
var apiContext = function (req, res, next) {
  const context = req.webtaskContext;
  
  // config cloudinary  
  cloudinary.config({
      "cloud_name": context.secrets.cloud_name,
      "api_key": context.secrets.api_key,
      "api_secret": context.secrets.api_secret
    });

  
  const page = context.data.page || 1;
  const pageSize = context.data.pageSize || 100;
  
  musicmatch_api_key = context.secrets.musicmatch_api_key;
  
  


  
  consumerkey = context.secrets.oauth_consumer_key;
  consumersecret =  context.secrets.oauth_consumer_secret;
  
  api = require('7digital-api').configure({
	  format: 'JSON',
	  consumerkey: context.secrets.oauth_consumer_key,
	  consumersecret: context.secrets.oauth_consumer_secret,
	  defaultParams: { 
	      country: 'GB', 
	    //  shopId: context.secrets.shop_id,
	      usageTypes: 'adsupportedstreaming',  
	      pageSize: pageSize, 
	      page:page, 
	      imageSize:800,
	      sort: 'popularity desc'
	  }
});

// create instances of individual apis
  artists = new api.Artists();
  releases = new api.Releases();
  tracks = new api.Tracks();
  console.log('API Inited.')
  next()
}

// Use our API Middleware
app.use(apiContext)

var TestMM = function(){
  const url = 'https://api.musixmatch.com/ws/1.1/matcher.lyrics.get';
  const data = {
    format:'json',
    q_track: 'all nerver',
    q_artist: 'the Breeders',
    apikey: musicmatch_api_key
  };

  axios({
    method:'get',
    url:url,
    data: data,
    responseType:'json'
    })
    .then(function(response) {
      return response;
    }).catch(function(error){
        return error;
    });
  
}

app.get('/test', function (req, res) {
  var results = TestMM();
    res.send( results);   
});




var getSong = function(context, trackid){
  // For access to locker / subscription streaming without managed users you
// will need to provide the accesstoken and secret for the user
var oauth = new api.OAuth();
    return new Promise(function (resolve, reject) {
       var apiUrl = 'https://stream.svc.7digital.net/stream/catalogue?country=GB&trackid=' + trackid;
       var signedURL = oauth.sign(apiUrl);
       if(signedURL){
          console.log(signedURL)
          resolve({url:signedURL});
       }else{
          reject('we had an error');
       }
      });
}

// /song/70540913/stream/

app.get('/song/:trackid/?:stream', function ( req, res) {
  
  const trackid = req.params.trackid  || '123456';  // /song/12345
  const context = req.webtaskContext;
  const shouldStream = req.params.stream  || "url";
  console.log(trackid);
  console.log(shouldStream);
  
  getSong(context, trackid).then(function(data){
    
      if(shouldStream == 'stream'){
        request(data.url).pipe(res);
      }else{
        res.send( data);   
      }
   }).catch(function(err){
      console.log('ERR:', Err);
      res.send(err);
   })
  
});



var getClip = function(trackid){
  
    return new Promise(function (resolve, reject) {
      var clipUrl = 'http://previews.7digital.com/clip/' + trackid;
      const oauth = new api.OAuth();
      var previewUrl = oauth.sign(clipUrl);
       if(previewUrl){
          console.log(previewUrl)
          resolve({ url:previewUrl });
       }else{
          reject('we had an error');
       }
      });
}
 
 // /song/70540913/stream/

 app.get('/clip/:trackid/?:stream', function ( req, res) {
  var trackid = req.params.trackid || '12345';   // /clip/12345
  const context = req.webtaskContext;
  const shouldStream = req.params.stream  || "url";
  
  getClip(trackid)
  .then(function(data){
      if(shouldStream == 'stream'){
        request(data.url).pipe(res);
      }else{
        res.send( data);   
      }
   })
   .catch(function(err){
      console.log('ERR:', Err);
      res.send(err);
   })
  
});

 
var browse = function(letter) {  
  return new Promise(function (resolve, reject) {
       artists.browse({ letter: letter }, function(err, data) {
              if(err){
               reject(err)
              }
              if(data){
                resolve(data);
              } 
            });    
  });
}
app.get('/browse/:letter', function ( req, res) {
  const letter = req.params.letter;   // /browse/letter

  browse(letter).then(function(data){
        console.log(JSON.stringify(data,null,5));
        res.send( data);   
   }).catch(function(err){
      console.log('ERR:', Err);
      res.send(err);
   })
  
});
  
  
  var search = function(query) {  
  return new Promise(function (resolve, reject) {
        artists.search({ q: query }, function(err, data) {
        if(err){
          console.log(err);
            reject(err)
        }
        if(data){
          console.log(JSON.stringify(data,null,5));
          resolve(data);
        } 
      });
  })
}
  
app.get('/search/:query', function ( req, res) {
  const query = req.params.query || 1;
  search(query).then(function(data){
        res.send( data);   
   })
   .catch(function(error){
      console.log('ERR: ', error);
      res.send(error);
   })
});
  
  
  //14643 The Breeders

var getReleases = function(artistID) {  
  return new Promise(function (resolve, reject) {
    
        artists.getReleases({ artistid: artistID }, function(err, data) {
        if(err){
          console.log(err);
            reject(err)
        }
        if(data){
          console.log(data);
          resolve(data);
        } 
      });
  })
}
    
app.get('/releases/:artistid', function ( req, res) {
const artistid = req.params.artistid || '14643';
  getReleases(artistid)
  .then(function(data){
        res.send( data);   
   }).catch(function(err){
      console.log('ERR:', Err);
      res.send(err);
   })
});

var getThemes = function(coverImageURL, public_id){
return  new Promise(function (resolve, reject) {
  var url = coverImageURL || 'http://res.cloudinary.com/de-demo/video/upload/v1520429530/test-audio.mp3' ; 
   
  
        // uses upload preset:  https://cloudinary.com/console/settings/upload
        cloudinary.v2.uploader.upload(url, 
              { 
              upload_preset: 'sxsw',  
              public_id: public_id,  
              type: "upload",
              resource_type: "image", 
              // raw_convert: "google_speech",
              // notification_url: "https://cloudinary.auth0-extend.com/api/run/evangelism/cloudinary-webhook"
              }, 
          function(error, result) {
            if(error){
                   reject( error);
            }
            if(result){
              console.log(result);
                    resolve(result);
            }
          });
        });
}



var getImagesByTags = function(tags){
return  new Promise(function (resolve, reject) {
           cloudinary.v2.api.resources_by_tag(tags,{max_results:100, tags:true}, 
           function(error, result){
             if(error){
               reject(error);
             }
             if(result){
               console.log(result);
               resolve(result);
             }
           });

        });
}



// Get tracks by releaseID: 
var getTracks = function(releaseid) {  
  return new Promise(function (resolve, reject) {
        releases.getTracks({ releaseid: releaseid }, function(err, data) {
        if(err){
          console.log(err);
            reject(err)
        }
        if(data){
       //   console.log(data);
          resolve(data);
        } 
      });
  })
}

// Get tracks by releaseID: 7456808
app.get('/tracks/:releaseid', function ( req, res) {
  
const releaseid = req.params.releaseid || '7456808';
console.log(releaseid)
  getTracks(releaseid)
  .then(function(data){
 //   console.log(data); 
    var tags = "clouds";
    getImagesByTags(tags)
    .then(function(dataTags){
 //     console.log('tags\n',dataTags);
   var meta =   dataTags.resources.map(function(item){
      var object = {};
      object.url = item.secure_url;
      object.public_id = item.public_id;
        return object;
      });
     
   // console.log('meta\n',meta);  
    
    
       const newTracks =   data.tracks.track.forEach(function(item, index){
            item.cloudinary = { meta:meta , tag:'clouds'};
            console.log(item,index);
         return item
      });
      data.tracks.track =  data.tracks.track; 
     // data.tracks.track[0].cloudinary = {meta: };
      console.log('data enhanced \n',data);
      res.send( data);   
    })
    .catch(function(error){
       res.send(error);
       console.log('error\n',error);
    });
    
    var trackData =  data.tracks.track.map(function(item){
      var object = {};
      object.coverImageURL = item.release.image;
      object.id = item.id;
      object.title = item.title;
      object.isrc = item.isrc;
      object.trackNumber = item.trackNumber;
      object.artist = item.artist;
      
      object.slug = item.release.slug;
      return object;
    });
      
//    console.log('My list\n', trackData); 
    
    // // Save image
    // var coverImageURL = data.tracks.track[0].release.image;
    // var public_id = data.tracks.track[0].title.replace(' ','_') + '_' + data.tracks.track[0].id;
    // console.log('coverImageURL', coverImageURL, public_id); 
    // // res.send( data);   
    //   getThemes(coverImageURL, public_id)
    //   .then(function(imageData){
    //       data.tracks.track[0].cloudinary = imageData;
    //       console.log(data); 
    //       res.send( data);   
    //     })
    //     .catch(function(error){
    //       console.log(error); 
    //     });
      
 
        
   }).catch(function(err){
      console.log('ERR:', err);
      res.send(err);
   })
});





// var getLyrics = function(isrc, data) {  
//   return new Promise(function (resolve, reject) {
//     //matcher.lyrics.get?track_isrc=isrc

       
//             reject(err)
   
//           resolve(data);
 
//   })
// }


var getDetails = function(trackid) {  
  return new Promise(function (resolve, reject) {
    
        tracks.getDetails({ trackid: trackid }, function(err, data) {
        if(err){
          console.log(err);
            reject(err)
        }
        if(data){
        //  console.log(data);
          resolve(data);
        } 
      });
  })
}


app.get('/details/:trackid', function ( req, res) {
const trackid = req.params.trackid || '14643';
  getDetails(trackid)
  .then(function(data){
    
    console.log(JSON.stringify(data,null,5));
  const isrc = data.tracks.track[0].isrc;
  console.log(isrc);
  
        res.send( data);   
   }).catch(function(err){
      console.log('ERR:', err);
      res.send(err);
   })
});


app.get('/', function (req, res) {
  
  res.sendStatus(200);
});




module.exports = Webtask.fromExpress(app);
