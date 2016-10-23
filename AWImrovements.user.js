// ==UserScript==
// @name          AW improvements
// @namespace     *
// @description   Add UKP review link to AW and moves some stats to the top of the page
// @include       https://www.adultwork.com/*
// @include       http://www.adultwork.com/*
// @version     1
// ==/UserScript==

if(sU && sU === parseInt(sU, 10)) {
	document.body.innerHTML = document.body.innerHTML.replace("<a href=\"javascript:void(0)\" onclick=\"viewRating","<a target=\"_blank\" href=\"//www.google.com/webhp?#q=inurl%3A%22ukpunting.com%2Findex.php%3Faction%3Dserviceprovider%22+"+sU+"\">UKP</a>&nbsp;&nbsp;&nbsp;<a href=\"javascript:void(0)\" onclick=\"viewRating");
	
	var age = "", county = "", nationality = "", town = "", chest = "", onehour = "---", checkinterview;
	
	onehour = "£" + document.getElementById("tdRI1").innerHTML;
	
	
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
