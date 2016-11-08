// ==UserScript==
// @name		AW improvements
// @namespace	*
// @description	Add UKP review link and counts to AW and moves some stats to the top of the page
// @include		https://www.adultwork.com/*
// @include		http://www.adultwork.com/*
// @version		1.2.2
// @grant		GM_xmlhttpRequest
// @connect		www.ukpunting.com
// @require		https://code.jquery.com/jquery-3.1.0.min.js
// ==/UserScript==

// Some formatting options
var posColour = "green";
var neuColour = "black";
var negColour = "red";
var reviewSeparator = "/";

var patterns = {
	galleryImage : /javascript:vGI\('(\d+%2Ejpg)','.*', '\d+'\)/g,
	userId : /[\?\&]userid=([^\&\#]+)/i
};

// Function to check if variable is (or can be cast to) an integer
// from http://stackoverflow.com/a/14794066
function isInt(value) {
	return !isNaN(value) && 
		parseInt(Number(value)) == value && 
		!isNaN(parseInt(value, 10));
}

// Function to format UNIX date value (seconds since Epoch) as dd/mm/yyyy 
// Technique courtesy of http://stackoverflow.com/a/30272803
function formatUnixDate(seconds) {
	var d = new Date(1000*seconds);
	return ("0" + d.getDate()).slice(-2) + "/" + ("0"+(d.getMonth()+1)).slice(-2) + "/" + d.getFullYear();
}

// Function to inject a function into the page
// Adapted from https://gist.github.com/nylen/6234717
function inject(src) {
	var el;
	el       = document.createElement('script');
	el.type  = 'text/javascript';
	el.class = 'injected';
	el.appendChild(document.createTextNode(src));
	var head = document.head || document.getElementsByTagName('head')[0];
	head.insertBefore(el, head.lastChild);
}

// Client side function to be injected (note no jQuery available on AW side)
function viewFullSizeImages() {
	var newWindow = window.open();
	var html = document.getElementById("galleryPageContent").innerHTML.replace(/data-src/g,"src");
	newWindow.document.write(html);
}

function extractImages(re, text, linkRoot){
	var images = [];
	var tempMatch;
	while ((tempMatch = re.exec(text)) !== null) {
		images.push(linkRoot+tempMatch[1].replace("%2E", "."));
	}
	return images;
}

function generateGalleryPage(imageArray) {
	var html = "";
	//var html = "<html><head><title>Gallery</title><body>";
	for(var i=0; i < imageArray.length; i++){
		html += "<img style=\"max-width:100%\" data-src=\""+imageArray[i]+"\"></a><br />";
	}
	//html += "</body></html>";
	return html;
}

// LINK TO IMAGES (Not dependent on on userId)

var galleryImages = extractImages(patterns.galleryImage, document.body.innerHTML, "https://cg.adultwork.com/G12/");

if (galleryImages.length > 0) {

	inject(viewFullSizeImages);
	$("body").append("<div style=\"display:none;\" id=\"galleryPageContent\">" + generateGalleryPage(galleryImages) + "</div>");

	var imageLink = "<div style=\"float: right\"><a href=\"javascript:viewFullSizeImages();\">View these " + galleryImages.length + " pics Full Size</a></div>";

	if ($("#tblGallery").length > 0) {
		// viewprofile.asp (Gallery tab)
		if ($("#tblGallery tbody tr:first td:first").html().indexOf("Showing most recent pictures") >= 0) {
			// If multiple pages, add our link to existing first row (which contains link to view all)
			$("#tblGallery tbody tr:first td:first").append(imageLink);
		} else {
			// If just the one page, add a new first row ontaining our link
			$("#tblGallery tbody tr:first td:first").before('<tr><td colspan="5">'+imageLink+'</td></tr>'); 
		}
	} else {
		// gallery.asp - when showing the full gallery
		$("table[cellspacing=20] tbody tr:first td:first").before('<tr><td colspan="5">'+imageLink+'</td></tr>'); 
	}	

}

// LINK TO UKP REVIEWS (if userId URL variable is present)

var userId  = document.URL.match (patterns.userId) [1];

if(isInt(userId)) {

	// First add the UKP link via Google (as per the original script) in case the API doesn't work for some reason
	var target = "<a href=\"javascript:void(0)\" onclick=\"viewRating";
	var replacement1 = "<a target=\"_blank\" href=\"//www.google.com/webhp?#q=inurl%3A%22ukpunting.com%2Findex.php%3Faction%3Dserviceprovider%22+"+userId+"\">UKP</a>&nbsp;&nbsp;&nbsp;"+target;
	document.body.innerHTML = document.body.innerHTML.replace(target,replacement1);

	// Second, call the API, and if OK replace the Google search links with links direct to UKP and add review counts
	var ret = GM_xmlhttpRequest({
		method: "GET",
		url: "https://www.ukpunting.com/aw2ukp.php?id="+userId,
		onload: function(res) {
			var ukpData = JSON.parse(res.responseText);
			if (ukpData.service_provider_id !== 0 && ukpData.review_count !== 0) {
				var firstReview = formatUnixDate(ukpData.first_review_time);
				var lastReview = formatUnixDate(ukpData.last_review_time);
				var reviewTooltip = ukpData.review_count + " review(s) between " + firstReview + " and " + lastReview;
				var reviews = "(";
				reviews += "<span style=\"color:" + posColour + "\">" + ukpData.positive_count + "</span>" + reviewSeparator;
				reviews += "<span style=\"color:" + neuColour + "\">" + ukpData.neutral_count + "</span>" + reviewSeparator;
				reviews += "<span style=\"color:" + negColour + "\">" + ukpData.negative_count + "</span>";
				reviews += ")";
				var replacement2 = "<span title=\"" + reviewTooltip + "\">"; 
				replacement2 += "<a target=\"_blank\" href=\"https://www.ukpunting.com/index.php?action=serviceprovider;id="+ukpData.service_provider_id+"\">UKP</a>"
				replacement2 += "&nbsp;"+reviews+"&nbsp;&nbsp;&nbsp;"+target;
				replacement2 += "</span>"
				document.body.innerHTML = document.body.innerHTML.replace(replacement1,replacement2);
			}
		}
	});


	// ALL ORIGINAL BELOW HERE ----------

	var age = "", county = "", nationality = "", town = "", chest = "", onehour = "---", checkinterview;
	if(document.getElementById('tdRI1') !== null) {
		onehour = "£" + document.getElementById("tdRI1").innerHTML;
	} else if(document.getElementById('tdRO1') !== null) {
		onehour = "Outcall £" + document.getElementById("tdRO1").innerHTML;
	}

	var myRegexp = /<td class="Label" align="right">([A-Za-z ]+):<\/td>\n *<td[^>]*>([^<]+)/g;
	var match;

	do {
		match = myRegexp.exec(document.getElementById("tblProfile").innerHTML);
		if(match === null) continue;
		if(match[1] == "Age") {
			age = match[2];
		} else if(match[1] == "County"){
			county = match[2];
		} else if(match[1] == "Town"){
			town = match[2];
		} else if(match[1] == "Nationality"){
			nationality = match[2];
		}
	} while(match !== null);

	myRegexp = /Chest Size:<\/td> <td class="Padded">([^<]+)<\/td>/g;

	match = myRegexp.exec(document.getElementById("tblProfile").innerHTML);
	if(match === null) {
		if(document.getElementById('tblInterview') !== null) {
			var band, cup, authenticity, size;
			myRegexp = /<td class="PaddedLabel" align="right">([^<]+)<\/td>\n[\t ]*<td class="Padded">([^<]+)<\/td>/g;
			do {
				match = myRegexp.exec(document.getElementById("tblInterview").innerHTML);
				if(match === null) continue;
				if(match[1] == "Breast Size") {
					size = match[2];
				} else if(match[1] == "Are your breasts natural or enhanced?"){
					authenticity = match[2];
				} else if(match[1] == "Chest Size"){
					band = match[2];
				} else if(match[1] == "Bra Cup-size"){
					cup = match[2];
				}
			} while(match !== null);
			if(band && cup) {
				chest = band + cup + "s";
			} else if(band) {
				chest = band + "\" breasts";
			} else if(cup) {
				chest = cup + " cups";
			} else if(size) {
				chest = size + " " + (authenticity == "Natural" ? "real":(authenticity == "Enhanced" ? "fake":"")) + " breasts";
			} else if(authenticity) {
				chest = (authenticity == "Natural" ? "real":(authenticity == "Enhanced" ? "fake":"")) + " breasts";
			}
			if((band||cup) && authenticity) {
				chest = (authenticity == "Natural" ? "Real":(authenticity == "Enhanced" ? "Fake":"")) + " " + chest;
			}
		}		
	} else {
		var elements = match[1].split(" ");
		if(elements.length == 1) {
			chest = elements[0] + " breasts";
		} else {			
			if(elements[1] == "Enhanced" || elements[1] == "Natural") {
				elements[2] = elements[1];
				elements[1] = "\" breast";
			}
			chest = (elements[2] == "Natural" ? "Real":(elements[2] == "Enhanced" ? "Fake":"")) + " " + elements[0].substring(0, elements[0].length - 1) + elements[1] + "s";
		}
	}
	var navbar, newElement;
	navbar = document.getElementsByClassName('PageHeading');
	if (navbar[0]) {
		newElement = document.createElement('p');
		var str2 = age;
		if(chest.length) {
			str2+= " | " +chest;
		}
		if(nationality.length) {
			str2+= " | " +nationality;
		}
		str2+= " | " + onehour;
		if(!town && county) town = county;
		if(town.length) {
			str2+= " | " +(town.length>17?town.substring(0,14)+"...":town);
		}
		var t = document.createTextNode(str2);
		newElement.appendChild(t);       
		navbar[0].parentNode.insertBefore(newElement, navbar[0].nextSibling);
		
		if(document.getElementById("dPref").innerHTML.indexOf("<td class=\"Padded\" nowrap=\"\">Bareback</td>") > -1 || document.getElementById("dPref").innerHTML.indexOf("<td class=\"Padded\" nowrap=\"\">Unprotected Sex</td>") > -1) {
			newElement2 = document.createElement('p');
			var t2 = document.createTextNode("Caution: Enjoys bareback");
			newElement2.appendChild(t2);       
			navbar[0].parentNode.insertBefore(newElement2, navbar[0].nextSibling);
		}
	}
	
} else {
	document.body.innerHTML = document.body.innerHTML.replace( /&nbsp;\(<a href="javascript:void\(0\)" onclick="viewRating\((\d+)\)/g ,"&nbsp;<a target=\"_blank\" href=\"//www.google.com/webhp?#q=inurl%3A%22ukpunting.com%2Findex.php%3Faction%3Dserviceprovider%22+$1\">UKP</a>&nbsp;(<a href=\"javascript:void(0)\" onclick=\"viewRating($1)");
}
