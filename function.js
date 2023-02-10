var map = L.map('map').setView([48.73, 2.24], 10);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

var defaultMap = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

var satellite = L.tileLayer(
    "https://wxs.ign.fr/choisirgeoportail/geoportail/wmts?" +
    "&REQUEST=GetTile&SERVICE=WMTS&VERSION=1.0.0" +
    "&STYLE=normal" +
    "&TILEMATRIXSET=PM" +
    "&FORMAT=image/jpeg" +
    "&LAYER=ORTHOIMAGERY.ORTHOPHOTOS" +
    "&TILEMATRIX={z}" +
    "&TILEROW={y}" +
    "&TILECOL={x}",
    {
        minZoom: 0,
        maxZoom: 18,
        attribution: "IGN-F/Geoportail",
        tileSize: 256 // les tuiles du Géooportail font 256x256px
    }
);

// Ajout des deux options de fond de carte à un contrôle de calque
var baseLayers = {
    "Fond de carte": defaultMap,
    Orthophotos: satellite,
};
L.control.layers(baseLayers).addTo(map);

var popup = L.popup();
var click = -1;
var marker;
var arrayMarkers = [];
var line;


const FirstAddress = "firstAddress";
const SecondAddress = "secondAddress";
const ClickRestart = -1;
const ClickEtat0 = 0;
const ClickEtat1 = 1;
const ClickEtat2 = 2;
const msgErreur = "itineraire impossible, réessayez plus tard"


var greenIcon = new L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

var redIcon = new L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

function onMapClick(e) {
    click++;
    switch (click) {
        case ClickEtat0:
            addGreenMarker(e);

            recupAdrByLatLongToDisplay(FirstAddress, e);
            break;

        case ClickEtat1:

            addRedMarker(e);

            recupAdrByLatLongToDisplay(SecondAddress, e);
            drawLine();
            break;

        case ClickEtat2:
            click = ClickEtat0;
            supprimerInfos();
            addGreenMarker(e);
            recupAdrByLatLongToDisplay(FirstAddress, e);
            break;

        default:
            break;
    }
}

async function fetchAddress(lon, lat) {
    const response = await fetch(
        "https://wxs.ign.fr/essentiels/geoportail/geocodage/rest/0.1/reverse?lon=" + lon + "&lat=" + lat + "&index=address&limit=10&returntruegeometry=false"
    );
    const data = await response.json();
    return data;
}

function displayAddress(jsonPromise, element) {
    jsonPromise.then((response) => {
        // Get response address
        var address = response.features[0].properties.label;

        // Display the address of the clicked point
        element.innerHTML = element.innerHTML + address;
    });
}

map.on('click', onMapClick);

document.getElementById("effacer").onclick = function () {
    click = ClickRestart;
    supprimerInfos();
}


function supprimerInfos() {
    // Remove the address' texts
    document.getElementById("firstAddress").innerHTML = "Point de départ : ";

    document.getElementById("secondAddress").innerHTML = "Point d'arrivée : ";

    arrayMarkers.forEach(function (marker) {
        //remove marker from the map
        map.removeLayer(marker);
        //marker.remove();
    });
    arrayMarkers = [];
    map.removeLayer(line);
}

function addGreenMarker(e) {
    //add popup to the map
    marker = L.marker(e.latlng, { icon: greenIcon }).addTo(map);
    //popup displaying the longitude and latitude of the clicked location
    marker.bindPopup("<b>Longitude:</b> " + e.latlng.lng.toFixed(2) + "<br><b>Latitude:</b> " + e.latlng.lat.toFixed(2)).openPopup();
    arrayMarkers.push(marker);
}

function addRedMarker(e) {
    //add popup to the map
    marker = L.marker(e.latlng, { icon: redIcon }).addTo(map);
    //popup displaying the longitude and latitude of the clicked location
    marker.bindPopup("<b>Longitude:</b> " + e.latlng.lng.toFixed(2) + "<br><b>Latitude:</b> " + e.latlng.lat.toFixed(2)).openPopup();
    arrayMarkers.push(marker);
}

async function recupAdrByLatLongToDisplay(champs, e) {
    var jsonPromise = fetchAddress(e.latlng.lng, e.latlng.lat);
    displayAddress(jsonPromise, document.getElementById(champs));
}


function drawLine() {
    var url = "https://wxs.ign.fr/calcul/geoportail/itineraire/rest/1.0.0/route?resource=bdtopo-pgr&start=" + arrayMarkers[0]["_latlng"]["lng"] + "," + arrayMarkers[0]["_latlng"]["lat"] + "&end=" + arrayMarkers[1]["_latlng"]["lng"] + "," + arrayMarkers[1]["_latlng"]["lat"] + "&profile=pedestrian";
    fetch(url)
        .then((resp) => resp.json())
        .then((obj) => {
            //return error if json is empty
            if (obj.error) {
                alert();
                supprimerInfos();
                click = ClickRestart;
                return;
            }
            var geometry = obj.geometry;
            displayLineGraph(geometry);
            line = L.geoJSON(geometry, { color: 'red' });
            line.addTo(map);
            map.fitBounds(line.getBounds());
        });

}

async function calculateAltimetricGraph(chunks, numberOfChunks) {
    
    // Add all the chunks to the url
    var url = "https://wxs.ign.fr/calcul/alti/rest/elevationLine.json?lon=";
   
    for (var i = 0 ; i < numberOfChunks ; i++) {
        
        if (i > 0) {
            url = url + "|";
        }
        url = url + chunks["features"][i]["geometry"]["coordinates"][0][0];
    }

    url += "&lat=";

    for (var i = 0 ; i < numberOfChunks ; i++) {
        
        if (i > 0) {
            url = url + "|";
        }
        url = url + chunks["features"][i]["geometry"]["coordinates"][0][1];
    }

    const response = await fetch(url);
    const data = await response.json();
    
    return data;
}

async function displayLineGraph(geometry){
    var numberOfChunks = 15;
    var length = turf.length(geometry);
    chunkLength = length / numberOfChunks;
    var chunks = turf.lineChunk(geometry, chunkLength);

    var altimetricGraph = calculateAltimetricGraph(chunks, numberOfChunks);

    altimetricGraph.then((response) => {
        var distances = [];
        var altitudes = [];
        var distCount = 0;
        for (var i = 0 ; i < response.elevations.length ; i++) {
            distCount = distCount + turf.length(chunks["features"][i])
            distances.push(distCount);
            altitudes.push(response["elevations"][i]["z"]);            
        }

        GRAPH = document.getElementById("graph");
        Plotly.newPlot(GRAPH, [{
            x: distances,
            y: altitudes
        }]);
    });
}