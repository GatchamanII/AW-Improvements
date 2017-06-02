// ==UserScript==
// @name		AW Improvements
// @namespace	*
// @description	Add UKP review link and counts to AW and moves some stats to the top of the page
// @include		https://www.adultwork.com/*
// @include		http://www.adultwork.com/*
// @version		1.6.0
// @grant		GM_getValue
// @grant		GM_setValue
// @grant		GM_xmlhttpRequest
// @connect		www.ukpunting.com
// @require		https://code.jquery.com/jquery-3.1.0.min.js
// ==/UserScript==

// GLOBAL VARIABLES =================================================
var config = {
	preferredDuration: 1
};

var interview = {}, preferences = [], profile = {};

// CONSTANTS ========================================================
const durations = {
	0.25: "15 min",
	0.5:  "\u00BD hr",
	1:    "hr",
	1.5:  "1\u00BD hrs",
	2:    "2 hrs",
	3:    "3 hrs",
	4:    "4 hrs",
	10:   "overnight"
};

const configKey = "AWImprovementsConfig";

const patterns = {
	galleryImage : /javascript:vGI\('(\d+%2Ejpg)','.*', '\d+'\)/g,
	userId : /[\?\&]userid=([^\&\#]+)/i,
	interviewRow : /<td class="PaddedLabel" align="right">([^<]+)<\/td>\n[\t ]*<td class="Padded">([^<]+)<\/td>/g,
	preferencesRow : /<td class="Padded" nowrap="">([^<]+)<\/td>/g,
	profileRow : /<td class="Label" align="right">([A-Za-z ]+):<\/td>\n *<td[^>]*>([^<]+)/g,
	postcode : /https?:\/\/www\.adultwork\.com\/Loaders\/GT\.asp\?Town=[^&]+&Country=[^&]+&PostCode=([^']+)',/g,
	profileLink : /Link to this Profile Page using (https?:\/\/www\.adultwork\.com\/[0-9]+  or <span itemprop="url">https?:\/\/www\.adultwork\.com\/[^<]+)/g,
	telephone : /<td><b itemprop="telephone">(.+)<\/b><\/td>/g,
	accessingFrom : /<tr>\s*<td class="Label" align="right"><span class="HelpLink" title="The IP address from which this member is accessing the Internet is registered to a different Country than which they puport to be in\.">Accessing From<\/span>:<br><img border="0" src="images\/1px\.gif" width="1" height="1"><\/td>\s*<td>([^<]+)<\/td>\s*<\/tr>/g
};

// Some formatting options
const posColour = "green", neuColour = "black", negColour = "red", reviewSeparator = "/";
const separator = "\u00B7"; // middot

// HTML/CSS for injection
const settingsFormHtml = `<form id="awiSettingsForm">
	<h3>AW Improvements Settings</h3>
	<table>
		<tr>
			<td>Duration:</td>
			<td>
				<select id="awiSettingsFieldDuration">
					<option value="0.25">15 min</option>
					<option value="0.5">\u00BD hr</option>
					<option value="1">1 hr</option>
					<option value="1.5">1\u00BD hrs</option>
					<option value="2">2 hrs</option>
					<option value="3">3 hrs</option>
					<option value="4">4 hrs</option>
					<option value="10">Overnight</option>
				</select>
			</td>
		</tr>
	</table><br><br>
	<button type="button" id="awiSettingsSaveButton">Save</button>
	<button type="button" id="awiSettingsCancelButton">Cancel</button>
</form>
<div id="awiPageMask"></div>`;

const cssCode = `<style type="text/css">
#awiInfoBarContainer {
	padding: 10px 0 0 0;
}

#awiSettingsForm {
	position: absolute;
	width: 200px;
	height: 150px;
	left: 50%;
	top: 50%;
	margin-left: -100px;
	margin-top: -75px;
	border: 1px solid black;
	padding: 12px 16px;
	background-color: white;
	box-shadow: 0 8px 20px 0 rgba(0, 0, 0, 0.3), 0 30px 50px 0 rgba(0, 0, 0, 0.25);
	border-radius: 5px;
	z-index: 100;
	display: none;
}

#awiPageMask {
	background: rgba(0, 0, 0, 0.5);
	position: fixed;
	top: 0;
	right: 0;
	bottom: 0;
	left: 0;
	z-index: 99;
	display: none;
}

#awiSettingsLink {
	margin-left: 10px;
	cursor: hand;
}

.awiWarning {
	padding: 0 0 15px 0;
	font-weight: bold;
}

.hilite {
	border:1px solid red;
	background: #dd0000;
}
</style>`;

const lastKnownTelRow = `<tr id="awiLastKnownTel">
	<td align="center" class="Padded"><img border="0" src="images/1px.gif" width="1" height="5"><br><b>Last known telephone number</b>:<br><img border="0" src="images/1px.gif" width="1" height="5"></td>
	<td align="center"><img border="0" src="images/1px.gif" width="20" height="1"></td>
	<td>
	<table border="0" cellpadding="0" cellspacing="5">
		<tr>
		<td><b itemprop="telephone">%TEL%</b></td>
		<td><a href="javascript:void(0)" onClick="openQRCodeWin('TEL:%TEL%')" title="Click here to see a QR Code image that you can scan with your phone, that contains this number.">Get QR</a></td>
		</tr>
		<tr>
		<td colspan="2"><i>(this SP is not currently displaying a telephone number.<br>The number shown here is the last known number <b>courtesy of UKP</b>)</i></td>
		</tr>
	</table></td>
</tr>`;

function addCss() {
	$('head').append(cssCode);
}

function loadConfig() {
	config = JSON.parse(GM_getValue(configKey, JSON.stringify(config)));
}

function saveConfig() {
	GM_setValue(configKey, JSON.stringify(config));
}

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
	return ('0' + d.getDate()).slice(-2) + '/' + ('0'+(d.getMonth()+1)).slice(-2) + '/' + d.getFullYear();
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

// FUNCTIONS TO EXRACT DATA FROM HTML TABLES ========================

// For tables that are just a list (eg Preferences)
function extractHtmlTableDataToArray(re, tableSelector) {
	var data = [];
	var tempMatch, value;
	while ((tempMatch = re.exec($(tableSelector).html())) !== null) {
		data.push(tempMatch[1].replace(/&amp;/g, 'and'));
	}
	return data;
}

// For tables with keys and values (eg interview)
function extractHtmlTableDataToObject(re, tableSelector) {
	var data = {};
	var tempMatch, value;
	while ((tempMatch = re.exec($(tableSelector).html())) !== null) {
		data[tempMatch[1].replace(/ /g, '_')] = tempMatch[2];
	}
	return data;
}

function extractImages(re, text, linkRoot){
	var images = [];
	var tempMatch;
	while ((tempMatch = re.exec(text)) !== null) {
		images.push(linkRoot+tempMatch[1].replace('%2E', '.'));
	}
	return images;
}

function generateGalleryPage(imageArray) {
	var html = "<html><head><title>Gallery</title><body>";
	for(var i=0; i < imageArray.length; i++){
		html += "<img style=\"max-width:100%\" data-src=\""+imageArray[i]+"\"></a><br />";
	}
	html += "</body></html>";
	return html;
}

function addFullSizeImageLink() {

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
}

function addSettingsLink() {
	$('body').append(settingsFormHtml);
	$('#awiSettingsLink').append('[Settings]');
	$(document).on("click", '#awiSettingsLink', function () {
		$("#awiSettingsFieldDuration").val(config.preferredDuration);
		$('#awiSettingsForm').show();
		$('#awiPageMask').show();
	});
	$(document).on('click', '#awiSettingsSaveButton', function () {
		config.preferredDuration = $('#awiSettingsFieldDuration').val();
		saveConfig();
		populateInfoBar();
		$('#awiSettingsForm').hide();
		$('#awiPageMask').hide();
	});
	$(document).on('click', '#awiSettingsCancelButton', function () {
		$('#awiSettingsForm').hide();
		$('#awiPageMask').hide();
	});
}

function addUKPLinkToList() {
	document.body.innerHTML = document.body.innerHTML.replace( /&nbsp;\(<a href="javascript:void\(0\)" onclick="viewRating\((\d+)\)/g ,"&nbsp;<a target=\"_blank\" href=\"//www.google.com/webhp?#q=inurl%3A%22ukpunting.com%2Findex.php%3Faction%3Dserviceprovider%22+$1\">UKP</a>&nbsp;(<a href=\"javascript:void(0)\" onclick=\"viewRating($1)");
}

function addUKPLinkToProfile(userId) {
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
				replacement2 += "<a target=\"_blank\" href=\"https://www.ukpunting.com/index.php?action=serviceprovider;id="+ukpData.service_provider_id+"\">UKP</a>";
				replacement2 += "&nbsp;"+reviews+"</span>&nbsp;&nbsp;&nbsp;"+target;
				document.body.innerHTML = document.body.innerHTML.replace(replacement1,replacement2);
			}
			if (ukpData.tel_no !== ''){
				// var telephone;
				// Need to reset lastIndex or it will fail every other time,
				// see http://stackoverflow.com/questions/3891641/regex-test-only-works-every-other-time
				patterns.telephone.lastIndex = 0;
				var tempMatch = patterns.telephone.exec($('body').html());
				if (tempMatch === null) {
					var contactTable = $('a.label[name="Contact"]').closest('table');
					contactTable.attr('id','awiContactTable');
					var lastRowType = 0;
					var lastRow = $('#awiContactTable > tbody > tr:last');
					if (lastRow.hasClass('AltRow')) {
						lastRowType = 1;
					}
					contactTable.append(lastKnownTelRow.replace(/%TEL%/g, ukpData.tel_no));
					if (lastRowType === 0) {
						$('#awiLastKnownTel').addClass("AltRow");
					}
				}
			}
		}
	});
}

function populateInfoBar() {

	var town = '', county = '', postcode = '', chest = '', rate = '£???';
	var spacedSeparator = ' ' + separator + ' ';

	// Age
	var info = profile.Age;

	// Dress Size
	if('Dress_Size' in interview) info += spacedSeparator + "Size " + interview.Dress_Size;

	// Bust Size
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

	if(chest.length) {
		info += spacedSeparator + chest;
	}

	// Nationality
	if ('Nationality' in profile) info += spacedSeparator + profile.Nationality;

	// Rate for preferred duration
	var d = config.preferredDuration;
	if(document.getElementById('tdRI' + d) !== null && document.getElementById('tdRI' + d).innerHTML !== "&nbsp;") {
		rate = "£" + document.getElementById("tdRI" + d).innerHTML;
	} else if(document.getElementById('tdRO' + d) !== null && document.getElementById('tdRO' + d).innerHTML !== "&nbsp;") {
		rate = "Outcall £" + document.getElementById("tdRO" + d).innerHTML;
	}
	if(d in durations) rate += "/" + durations[d];
	info += spacedSeparator + rate;

	// Location
	// Need to reset lastIndex or it will fail eey other time,
	// see http://stackoverflow.com/questions/3891641/regex-test-only-works-every-other-time
	patterns.postcode.lastIndex = 0;
	var tempMatch = patterns.postcode.exec($('head').html());
	if (tempMatch !== null) {
		postcode = tempMatch[1].toUpperCase();
	}

	if ('Town' in profile) town = profile.Town;
	if ('County' in profile) county = profile.County;
	if (!town && county) town = county;
	if (town.length || postcode.length) {
		info += spacedSeparator;
		if (postcode.length) info += postcode;
		if (town.length && postcode.length) info += ', ';
		if (town.length) info += (town.length > 17 ? town.substring(0,14) + "..." : town);
	}

	$("#awiInfoBar").html(info);

}

function addContainers() {
	$('.PageHeading').after('<div id="awiInfoBarContainer"></div>');
	$('#awiInfoBarContainer').append('<span id="awiInfoBar"></span>');
	$('#awiInfoBarContainer').append('<span id="awiSettingsLink"></span>');
}

function getUserId() {
	var userId = 0;
	var matches = document.URL.match(patterns.userId);
	if (matches !== null && isInt(matches[1])) {
		userId  = matches[1];
	}
	return userId;
}

function checkForBareback() {
	if(preferences.indexOf('Bareback') > -1 || preferences.indexOf('Unprotected Sex') > -1) {
		$('#awiInfoBarContainer').prepend('<div class="awiWarning">Caution: Enjoys bareback</div>');
	}
}

function checkAccessingFrom() {
	// Need to reset lastIndex or it will fail every other time,
	// see http://stackoverflow.com/questions/3891641/regex-test-only-works-every-other-time
	patterns.accessingFrom.lastIndex = 0;
	var tempMatch = patterns.accessingFrom.exec($('body').html());
	if (tempMatch !== null) {
		$('#awiInfoBarContainer').prepend('<div class="awiWarning">Accessing from ' + tempMatch[1] + '</div>');
	}
}

function fixAntiSocialBehaviour() {
	// Make text selectable again.  No need to worry about the "unselectable" attribute as it only applies in IE and Opera
	// Most of the action here is applied through the .unSelectable class and the onselectstart event listener, so remove them.
	$('.unSelectable')
		.removeClass("unSelectable")
		.removeAttr('onselectstart');
	// Can't get the below to work with jQuery
	for(i=0;i<document.images.length;i++) {document.images[i].oncontextmenu = null;}		
}

$(document).ready(function () {
	fixAntiSocialBehaviour();
	addFullSizeImageLink();
	var userId = getUserId();
	if (userId !== 0) {
		addUKPLinkToProfile(userId);
		if (location.pathname.toLowerCase() == '/viewprofile.asp') {
			if ($("#tblInterview")) {
				interview = extractHtmlTableDataToObject(patterns.interviewRow, "#tblInterview");
			}
			if ($("#dPref")) {
				preferences = extractHtmlTableDataToArray(patterns.preferencesRow, "#dPref");
			}
			if ($("#tblProfile")) {
				profile = extractHtmlTableDataToObject(patterns.profileRow, "#tblProfile");
			}
			loadConfig();
			addCss();
			addContainers();
			populateInfoBar();
			addSettingsLink();
			checkForBareback();
	checkAccessingFrom();
		}
	}
});