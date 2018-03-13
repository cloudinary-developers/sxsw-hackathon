const cloudinary = require('cloudinary');
const express    = require('express');
const Webtask    = require('webtask-tools');
const bodyParser = require('body-parser');
const request = require('request');
const parsePath = require('parse-filepath');

const axios = require('axios');
const JSONP = require('node-jsonp');
var Algorithmia = require('algorithmia');



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
        shopId: context.secrets.shop_id,
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


var analyiseLyrics = function(lyrics){
  
Algorithmia.client("simEzw9S/E6t4h5nYL3TLYyACn61")
    .algo("nlp/AutoTag/1.0.1")
    .pipe(lyrics)
    .then(function(response) {
        console.log(response.get());
    });
  
}

var getLyrics = function(params){
  
  const data = {
    format:'jsonp',
    callback: 'callback',
    q_track: params.q_track,
    q_artist: params.q_artist,
    track_isrc: params.track_isrc,
    apikey: musicmatch_api_key
  };
  
  const url = 'https://api.musixmatch.com/ws/1.1/matcher.lyrics.get';
  return new Promise(function (resolve, reject) {
  
  JSONP(url,data,'callback',function(response){
     console.log(response.message.body);
     const lyrics =  response.message.body.lyrics;
       if(lyrics){
         resolve(lyrics);  
       }else{
         reject("There was an error getting lyrics");
       }
    });
    
  });
  
}

app.get('/lyrics', function (req, res) {
  
  var q_artist = req.params.artist  || 'The Breeders';  // /lyrics/The Breeders/
  var q_track = req.params.track  || 'Spacewoman';  // /lyrics/The Breeders/All Nerve/
  const context = req.webtaskContext;
  const track_isrc = context.data.isrc || 'GBAFL1700342';  //?Spacewoman
  
    if(track_isrc){
      q_artist = "";
      q_track = ""
    }
  
  const data = {
    q_track: q_track,
    q_artist: q_artist,
    track_isrc: track_isrc,
   };

   getLyrics(data)
   .then(function(lyrics){
          res.send(lyrics);
   })
   .catch(function(error){
          res.send(error);
   });
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

var saveCoverImage = function(coverImageURL, public_id){
return  new Promise(function (resolve, reject) {
  var url = coverImageURL || 'http://res.cloudinary.com/de-demo/video/upload/v1520429530/test-audio.mp3' ; 
   
        // uses upload preset:  https://cloudinary.com/console/settings/upload
        cloudinary.v2.uploader.upload(url, 
              { 
              upload_preset: 'sxsw',  
              public_id: public_id,  
              type: "upload",
              resource_type: "image", 
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
          resolve(data);
        } 
      });
  })
}



app.get('/tracks/:releaseid', function( req , res ){
  const releaseid = req.params.releaseid || '7456808';
    console.log(releaseid)
     releases.getTracks({ releaseid: releaseid }, function(err, tracksData) {
        if(err){
          console.log(err);
        }
        if(tracksData){
          var items = [];
          var len = tracksData.tracks.track;
            tracksData.tracks.track.forEach(function(item, index){
           
              const data = { track_isrc: item.isrc};
                getLyrics(data).then(function(lyrics){
                  item.lyrics = lyrics.lyrics_body;
                   items.push(item);
                   
                  })
                  .catch(function(err){
                   console.log(err);
                   res.send(err);   
                  });
                  
                  if(len === index){
                       console.log(items);
                       res.send(items);   
                    }
      });
        }
     }); 
});



// Get tracks by releaseID: 7456808
app.get('/tracks1/:releaseid', function ( req, res) {
  
const releaseid = req.params.releaseid || '7456808';
console.log(releaseid)


  getTracks(releaseid)
  .then(function(data){
    var lyricsList = [];
    
     const newTracks =   data.tracks.track.forEach(function(item, index){
         const data = { track_isrc: item.isrc};
          getLyrics(data)
          .then(function(lyrics){
           //   console.log(lyrics.lyrics_body);
              item.lyrics = lyrics.lyrics_body
            })
           .catch(function(error){
                 console.log('error\n',error);
                  res.send(error);   
           });
         
            item.cloudinary = { meta:meta , tag:'clouds'};
            console.log(item,index);
        return item
      });
    
    
     res.send(newTracks);  
    
    // data.tracks.track.forEach(function(item, index){
    //     const data = { track_isrc: item.isrc};
    //       getLyrics(data)
    //       .then(function(lyrics){
    //           console.log(lyrics.lyrics_body);
    //           lyricsList.push(lyrics);
    //           res.send(lyrics);   
    //         })
    //       .catch(function(error){
    //             console.log('error\n',error);
    //               res.send(error);   
    //       });
    //   });
     
    
    

   
    
    
    
// //   console.log(data); 
//     var tags = "clouds";
//     getImagesByTags(tags)
//     .then(function(dataTags){
// //     console.log('tags\n',dataTags);
//   var meta = dataTags.resources.map(function(item){
//         var object = {};
//         object.url = item.secure_url;
//         object.public_id = item.public_id;
//         return object;
//       });
     
//   // console.log('meta\n',meta);  
    
    
//       const newTracks =   data.tracks.track.forEach(function(item, index){
         
//             item.cloudinary = { meta:meta , tag:'clouds'};
//             console.log(item,index);
//         return item
//       });
//       data.tracks.track =  data.tracks.track; 
//     // data.tracks.track[0].cloudinary = {meta: };
//       console.log('data enhanced \n',data);
//       res.send( data);   
//     })
//     .catch(function(error){
//       res.send(error);
//       console.log('error\n',error);
//     });
    
    // var trackData =  data.tracks.track.map(function(item){
    //   var object = {};
    //   object.coverImageURL = item.release.image;
    //   object.id = item.id;
    //   object.title = item.title;
    //   object.isrc = item.isrc;
    //   object.trackNumber = item.trackNumber;
    //   object.artist = item.artist;
      
    //   object.slug = item.release.slug;
    //   return object;
    // });
      
//    console.log('My list\n', trackData); 
    
    // // Save image
    // var coverImageURL = data.tracks.track[0].release.image;
    // var public_id = data.tracks.track[0].title.replace(' ','_') + '_' + data.tracks.track[0].id;
    // console.log('coverImageURL', coverImageURL, public_id); 
    // // res.send( data);   
    //   saveCoverImage(coverImageURL, public_id)
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
