import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMap, Popup } from "react-leaflet";
import { IconAlertTriangleFilled, IconMapShare } from "@tabler/icons-react";
import L from "leaflet";
import { Loader } from "./Loader";
import { replaceTextWithIcons } from "../../utils/htmlUtils";

// Mapy.cz API klíč
const MAPY_API_KEY = "67fA8acT3ISVkTZEz3CYnTiXVo32Xvh1k1obif0B3d4";

// SVG pro platný marker (černý)
const signSvg = encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><path fill="#000" d="M11 21v-3H6.825q-.4 0-.763-.15t-.637-.425L3.7 15.7q-.3-.3-.3-.7t.3-.7l1.725-1.725q.275-.275.638-.425t.762-.15H11v-2H5q-.425 0-.712-.288T4 9V5q0-.425.288-.712T5 4h6V3q0-.425.288-.712T12 2t.713.288T13 3v1h4.175q.4 0 .763.15t.637.425L20.3 6.3q.3.3.3.7t-.3.7l-1.725 1.725q-.275.275-.638.425t-.762.15H13v2h6q.425 0 .713.288T20 13v4q0 .425-.288.713T19 18h-6v3q0 .425-.288.713T12 22t-.712-.288T11 21"/></svg>`);
const signIcon = new L.DivIcon({
    className: "",
    iconSize: [28, 28],
    html: `<img src="data:image/svg+xml;utf8,${signSvg}" alt="TIM marker" style="display:block"/>`
});

// SVG pro neplatný marker (červený)
const signSvgInvalid = encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><path fill="#d00" d="M11 21v-3H6.825q-.4 0-.763-.15t-.637-.425L3.7 15.7q-.3-.3-.3-.7t.3-.7l1.725-1.725q.275-.275.638-.425t.762-.15H11v-2H5q-.425 0-.712-.288T4 9V5q0-.425.288-.712T5 4h6V3q0-.425.288-.712T12 2t.713.288T13 3v1h4.175q.4 0 .763.15t.637.425L20.3 6.3q.3.3.3.7t-.3.7l-1.725 1.725q-.275.275-.638.425t-.762.15H13v2h6q.425 0 .713.288T20 13v4q0 .425-.288.713T19 18h-6v3q0 .425-.288.713T12 22t-.712-.288T11 21"/></svg>`);
const signIconInvalid = new L.DivIcon({
    className: "",
    iconSize: [28, 28],
    html: `<img src="data:image/svg+xml;utf8,${signSvgInvalid}" alt="Invalid TIM marker" style="display:block"/>`
});

// FitBounds podle bodů
function FitBounds({ points }) {
    const map = useMap();
    useEffect(() => {
        if (!points.length) return;
        const bounds = L.latLngBounds(points.map(({ lat, lon }) => [lat, lon]));
        map.fitBounds(bounds, { padding: [40, 40] });
    }, [points, map]);
    return null;
}

// Validátor platných bodů v ČR
function isValidPoint(point) {
    if (
        typeof point.lat !== "number" ||
        typeof point.lon !== "number" ||
        isNaN(point.lat) ||
        isNaN(point.lon)
    ) return false;
    return (
        point.lat >= 48.5 && point.lat <= 51.2 &&
        point.lon >= 12.0 && point.lon <= 19.0
    );
}

// Tvorba správné URL pro routing API
function buildMapyRouteUrl(body, apiKey, type) {
    if (body.length < 2) throw new Error("Musí být alespoň dva body!");
    const [start, ...rest] = body;
    const end = rest.length ? rest[rest.length - 1] : start;
    const waypoints = rest.length > 1 ? rest.slice(0, -1) : [];
    const url = new URL("https://api.mapy.cz/v1/routing/route");
    url.searchParams.append("start", `${start.lon},${start.lat}`);
    url.searchParams.append("end", `${end.lon},${end.lat}`);
    url.searchParams.append("routeType", `${type}`);
    url.searchParams.append("lang", "cs");
    url.searchParams.append("format", "geojson");
    url.searchParams.append("avoidToll", "false");
    url.searchParams.append("apikey", apiKey);
    waypoints.forEach(({ lat, lon }) => {
        url.searchParams.append("waypoints", `${lon},${lat}`);
    });
    return url.toString();
}

// Tvorba odkazu pro jeden bod (marker):
function getMapyCzShowMapUrl(lon, lat, mapset) {
    if (typeof lon !== "number" || typeof lat !== "number") return null;
    return `https://mapy.cz/fnc/v1/showmap?mapset=${mapset}&center=${lon},${lat}&zoom=16&marker=true`;
}

// Tvorba odkazu pro trasu (start, end, waypoints):
function getMapyCzRouteUrl(points, mapset, type) {
    if (!Array.isArray(points) || points.length < 2) return null;
    const [start, ...rest] = points;
    const end = rest.length ? rest[rest.length - 1] : start;
    const waypoints = rest.length > 1 ? rest.slice(0, -1) : [];
    const waypointsParam = waypoints.length
        ? "&waypoints=" +
        waypoints.map(w => `${w.lon},${w.lat}`).join(";")
        : "";
    return (
        `https://mapy.cz/fnc/v1/route?mapset=` + mapset +
        `&start=${start.lon},${start.lat}` +
        `&end=${end.lon},${end.lat}` +
        `&routeType=` + type +
        waypointsParam
    );
}

// Barva_Kod → barva vedoucího pruhu (vnitřní polyline)
const ROUTE_COLORS = {
    CE: '#e50313',  // červená
    MO: '#1a6dff',  // modrá
    ZE: '#009C00',  // zelená
    ZL: '#ffdd00',  // žlutá
    BI: '#ffffff',  // bílá
};
const DEFAULT_ROUTE_COLOR = '#ff57a0';

function getRouteColor(barvaKod) {
    return ROUTE_COLORS[barvaKod] || DEFAULT_ROUTE_COLOR;
}

// Druh_Presunu → barva upozorňovacího pruhu (outline polyline)
// Odpovídá ColorService::barvaDlePresunu() na backendu
function getOutlineColor(druhPresunu) {
    const mapping = {
        'PZT': '#ffffff',  // bílá (RAL 1013 - perlová bílá)
        'LZT': '#f7951d',  // oranžová (RAL 2009 - dopravní oranžová)
        'CZT': '#ffe000',  // žlutá (RAL 1003 - signální žlutá)
        'CZS': '#ffe000',  // žlutá (RAL 1003 - signální žlutá)
    };
    return mapping[druhPresunu] || '#ffffff';
}

// Druh_Presunu → Mapy.cz routeType
function getMapyRouteType(druhPresunu) {
    const mapping = {
        'PZT': 'foot_hiking',      // Pěší značené trasy
        'LZT': 'foot_hiking',      // Lyžařské trasy (fallback - routing se skipuje)
        'CZT': 'bike_mountain',    // Cyklotrasy terénní
        'CZS': 'bike_road',        // Cyklotrasy silniční
        'VZT': 'foot_hiking',      // Vozíčkářské trasy
    };
    return mapping[druhPresunu] || 'foot_hiking';
}

// Fetch routing z Mapy.cz API pro jednu trasu
function fetchRouteCoords(points, druhPresunu) {
    if (!points || points.length < 2 || druhPresunu === 'LZT') {
        return Promise.resolve([]);
    }
    const type = getMapyRouteType(druhPresunu);
    const url = buildMapyRouteUrl(points, MAPY_API_KEY, type);
    return fetch(url)
        .then(r => {
            if (!r.ok) throw new Error("Chyba API");
            return r.json();
        })
        .then(data => {
            if (
                data?.geometry?.geometry?.type === "LineString" &&
                Array.isArray(data.geometry.geometry.coordinates)
            ) {
                return data.geometry.geometry.coordinates.map(
                    ([lon, lat]) => [lat, lon]
                );
            }
            return [];
        })
        .catch(() => []);
}

function MapInfoText() {
    const [showDetails, setShowDetails] = useState(false);

    return (
        <div className="alert alert--info mt-4">
            <div className="alert__content">
                <div className="flex items-start gap-2">
                    <IconAlertTriangleFilled className="shrink-0 mt-0.5" />
                    <div>
                        <p>
                            Mapa ukazuje TIMy uvedené ve značkařském příkazu.
                            (Chybějící nebo chybně zakreslené prosím reklamujte u obvodu vlastnícího TIM).{' '}
                            <span
                                className="underline cursor-pointer text-blue-700 dark:text-blue-300"
                                onClick={() => setShowDetails(!showDetails)}
                            >
                                Omezení zakreslené trasy pro jednotlivé typy zobrazení je zde.
                            </span>
                        </p>
                        {showDetails && (
                            <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                                <li><strong>Pěší</strong> – někdy nedrží barvu a ukážou vám kratší spojnici TIMů (je to ale velmi vzácné)</li>
                                <li><strong>Cyklistické</strong> – logika se údajně snaží minimalizovat nutnost otočit se s kolem a občas vyrobí podivnosti (hlaste prosím na insyz@kct.cz)</li>
                                <li><strong>Lyžařské vč. souběhů s pěší, vozíčkářské</strong> – trasu nejde namalovat, zobrazujeme jen TIMy</li>
                            </ul>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export function MapaTrasy({ data: { title = '', points, route, routes = null } }) {
    const hasRoutes = Array.isArray(routes) && routes.length > 0;

    // Route coords state: { [EvCi_Tra]: coords[] }
    const [routeCoords, setRouteCoords] = useState({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [leafletLoaded, setLeafletLoaded] = useState(false);

    // Dynamické načtení Leaflet CSS
    useEffect(() => {
        if (!leafletLoaded) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
            link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
            link.crossOrigin = '';
            document.head.appendChild(link);
            setLeafletLoaded(true);
        }
    }, [leafletLoaded]);

    // Rozdělení bodů na platné/neplatné
    const validPoints = points.filter(isValidPoint);
    const invalidPoints = points.filter(p => !isValidPoint(p));

    // Routing fetch pro všechny trasy
    useEffect(() => {
        if (!hasRoutes || !route) return;

        setLoading(true);
        setError(null);

        const promises = routes.map(r =>
            fetchRouteCoords(r.points, r.Druh_Presunu).then(coords => ({
                key: r.key || r.EvCi_Tra,
                coords
            }))
        );

        Promise.all(promises)
            .then(results => {
                const coordsMap = {};
                results.forEach(({ key, coords }) => {
                    coordsMap[key] = coords;
                });
                setRouteCoords(coordsMap);
                setLoading(false);
            })
            .catch(() => {
                setError("Nepodařilo se načíst trasy.");
                setLoading(false);
            });
        // eslint-disable-next-line
    }, [hasRoutes, route, routes?.map(r => r.key || r.EvCi_Tra).join('|')]);

    const center = validPoints[0]
        ? [validPoints[0].lat, validPoints[0].lon]
        : [49.8, 14.8];
    const height = window.innerWidth > 768 ? 500 : 350;

    // Zjistit zda existuje alespoň jedna vykreslená trasa
    const hasAnyRouteCoords = Object.values(routeCoords).some(c => c.length > 1);

    // Zjistit zda jsou všechny trasy lyžařské
    const allRoutesLZT = hasRoutes && routes.every(r => r.Druh_Presunu === 'LZT');

    // Výchozí mapset podle první trasy
    const mapset = (hasRoutes && routes[0]?.Druh_Presunu === 'LZT') ? 'winter' : 'outdoor';

    return (
        <div style={{ minHeight: height, width: "100%", position: "relative" }}>
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">{title}</h3>
            </div>

            {loading && <Loader />}

            {validPoints.length > 0 && leafletLoaded && (
                <>
                    <MapContainer
                        style={{ height: height, width: "100%", zIndex: 1 }}
                        center={center}
                        zoom={13}
                        scrollWheelZoom={false}
                    >
                        <TileLayer
                            url={`https://api.mapy.cz/v1/maptiles/${mapset}/256/{z}/{x}/{y}?apikey=${MAPY_API_KEY}`}
                            attribution='© <a href="https://www.seznam.cz/">Seznam.cz, a.s.</a> a další'
                            eventHandlers={{
                                add: (e) => {
                                    e.target.getContainer().style.filter = 'grayscale(40%) opacity(90%)';
                                }
                            }}
                        />
                        {validPoints.map((point, i) => (
                            <Marker
                                key={"valid" + i}
                                position={[point.lat, point.lon]}
                                icon={signIcon}
                            >
                                <Popup>
                                    {point.content}
                                    <button
                                        onClick={() => window.open(getMapyCzShowMapUrl(point.lon, point.lat, mapset), '_blank')}
                                        className="btn btn--secondary btn--small flex items-center gap-1 mt-2"
                                    >
                                        <IconMapShare size={14} />
                                        Mapy.cz
                                    </button>
                                </Popup>
                            </Marker>
                        ))}
                        {invalidPoints.map((point, i) => (
                            <Marker
                                key={"invalid" + i}
                                position={[
                                    typeof point.lat === "number" ? point.lat : 0,
                                    typeof point.lon === "number" ? point.lon : 0
                                ]}
                                icon={signIconInvalid}
                            >
                                <Popup>
                                    <p className="text-red-600">Neplatný bod:</p>
                                    {point.content}
                                    <button
                                        onClick={() => window.open(getMapyCzShowMapUrl(point.lon, point.lat, mapset), '_blank')}
                                        className="btn btn--secondary btn--small flex items-center gap-1 mt-2"
                                    >
                                        <IconMapShare size={14} />
                                        Mapy.cz
                                    </button>
                                </Popup>
                            </Marker>
                        ))}
                        {/* Polylines tras s popupy */}
                        {hasRoutes && routes.map(r => {
                            const routeKey = r.key || r.EvCi_Tra;
                            const coords = routeCoords[routeKey];
                            if (!coords || coords.length < 2) return null;
                            const routeMapset = r.Druh_Presunu === 'LZT' ? 'winter' : 'outdoor';
                            const routeType = getMapyRouteType(r.Druh_Presunu);
                            const routeUrl = getMapyCzRouteUrl(r.points, routeMapset, routeType);
                            const outlineColor = getOutlineColor(r.Druh_Presunu);
                            return (
                                <React.Fragment key={routeKey}>
                                    <Polyline
                                        positions={coords}
                                        color={outlineColor}
                                        weight={10}
                                        opacity={0.9}
                                    />
                                    <Polyline
                                        positions={coords}
                                        color={getRouteColor(r.Barva_Kod)}
                                        weight={4}
                                    >
                                        <Popup>
                                            <div className="text-sm">
                                                <p className="font-semibold mb-1">{r.Nazev_ZU ? replaceTextWithIcons(r.Nazev_ZU, 14) : r.EvCi_Tra}</p>
                                                {routeUrl && (
                                                    <button
                                                        onClick={() => window.open(routeUrl, '_blank')}
                                                        className="btn btn--secondary btn--small flex items-center gap-1 mt-2"
                                                    >
                                                        <IconMapShare size={14} />
                                                        Mapy.cz
                                                    </button>
                                                )}
                                            </div>
                                        </Popup>
                                    </Polyline>
                                </React.Fragment>
                            );
                        })}
                        <FitBounds points={validPoints} />
                    </MapContainer>

                    {route && (
                        <MapInfoText />
                    )}
                </>
            )}

            {error && (
                <div className="alert alert--danger mt-4">
                    <div className="alert__content">
                        <div className="flex items-start gap-2">
                            <IconAlertTriangleFilled />
                            <div>{error}</div>
                        </div>
                    </div>
                </div>
            )}

            {invalidPoints.length > 0 && (
                <div className="alert alert--danger mt-4">
                    <div className="alert__content">
                        <div className="flex items-start gap-2">
                            <IconAlertTriangleFilled />
                            <div>
                                <div className="font-medium mb-2">Body s neplatnými souřadnicemi</div>
                                <ul className="list-disc list-inside space-y-1">
                                    {invalidPoints.map((point, idx) => (
                                        <li key={idx} className="text-sm">
                                            {point.content || (
                                                <span className="text-sm">
                                                    {JSON.stringify(point)}
                                                </span>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default MapaTrasy;
