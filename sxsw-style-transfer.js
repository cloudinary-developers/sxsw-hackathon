/**
* @param context {WebtaskContext}
*  Requires Cloudinary, 7Digital-api and request
*/

const cloudinary = require('cloudinary');
const request = require('request');


module.exports = function(context, req ,res) {
  
  if(context.secrets.WT_API_KEY != context.data.auth_key){
    const message = 'You are not authorized to use this api without an auth_key';
    return  cb(null, message);
  }
  
    // config cloudinary  
   cloudinary.config({
      "cloud_name": context.secrets.cloud_name,
      "api_key": context.secrets.api_key,
      "api_secret": context.secrets.api_secret
    });
    
    const effect = context.data.effect ||  "style_transfer";
    const public_id = context.data.public_id ||  "domestic-dog_thumb_ceymam";
    const overlay = context.data.overlay || "starrynight"; // "the-breeders-all-nerve";
    
    const strength =  context.data.strength ||  "";
    var style_strength = "";
    if(strength){
      style_strength = ":preserve_color:" + strength || "";
    }
    
    
    var image = cloudinary.url(public_id + ".jpg",{overlay:overlay,effect: effect + style_strength, sign_url: true});
    console.log(image)
      //  res.writeHead(200, { 'Content-Type': 'text/html '});
     // res.end(image);
      
       request(image).pipe(res);
};