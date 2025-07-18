import React, {useEffect, useState} from "react";
import {MapContainer, TileLayer, Marker, Polyline, useMap, Popup} from "react-leaflet";
import {Alert, Box, Button, Flex, Group, Loader, Text, Title} from "@mantine/core";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {IconAlertTriangleFilled, IconMapShare} from "@tabler/icons-react";

// Mapy.cz API klíč
const MAPY_API_KEY = "67fA8acT3ISVkTZEz3CYnTiXVo32Xvh1k1obif0B3d4";
const OPEN_ROUTE_KEY = "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjE5NjYyMDUwODI0NTQ5NmE5YTM2NTA0ZDM3MzU5YzVkIiwiaCI6Im11cm11cjY0In0=";

// SVG pro platný marker (černý)
const signSvg = encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><path fill="#000" d="M11 21v-3H6.825q-.4 0-.763-.15t-.637-.425L3.7 15.7q-.3-.3-.3-.7t.3-.7l1.725-1.725q.275-.275.638-.425t.762-.15H11v-2H5q-.425 0-.712-.288T4 9V5q0-.425.288-.712T5 4h6V3q0-.425.288-.712T12 2t.713.288T13 3v1h4.175q.4 0 .763.15t.637.425L20.3 6.3q.3.3.3.7t-.3.7l-1.725 1.725q-.275.275-.638.425t-.762.15H13v2h6q.425 0 .713.288T20 13v4q0 .425-.288.713T19 18h-6v3q0 .425-.288.713T12 22t-.712-.288T11 21"/></svg>`);
const signIcon = new L.DivIcon({
	className: "",
	iconSize: [28, 28],
	html: `<img src="data:image/svg+xml;utf8,${signSvg}" style="display:block"/>`
});

// SVG pro neplatný marker (červený)
const signSvgInvalid = encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><path fill="#d00" d="M11 21v-3H6.825q-.4 0-.763-.15t-.637-.425L3.7 15.7q-.3-.3-.3-.7t.3-.7l1.725-1.725q.275-.275.638-.425t.762-.15H11v-2H5q-.425 0-.712-.288T4 9V5q0-.425.288-.712T5 4h6V3q0-.425.288-.712T12 2t.713.288T13 3v1h4.175q.4 0 .763.15t.637.425L20.3 6.3q.3.3.3.7t-.3.7l-1.725 1.725q-.275.275-.638.425t-.762.15H13v2h6q.425 0 .713.288T20 13v4q0 .425-.288.713T19 18h-6v3q0 .425-.288.713T12 22t-.712-.288T11 21"/></svg>`);
const signIconInvalid = new L.DivIcon({
	className: "",
	iconSize: [28, 28],
	html: `<img src="data:image/svg+xml;utf8,${signSvgInvalid}" style="display:block"/>`
});

// FitBounds podle bodů
function FitBounds({points}: {points: any[]}) {
	const map = useMap();
	useEffect(() => {
		if (!points.length) return;
		const bounds = L.latLngBounds(points.map(({lat, lon}) => [lat, lon]));
		map.fitBounds(bounds, {padding: [40, 40]});
	}, [points, map]);
	return null;
}

// Validátor platných bodů v ČR
function isValidPoint(point: any) {
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

// Map druhPresunu to OpenRouteService profiles
function mapDruhPresunuToORSProfile(druhPresunu: string) {
	const mapping: Record<string, string> = {
		'PZT': 'foot-hiking',      // Pěší značené trasy
		'LZT': 'foot-walking',     // Lyžařské trasy
		'CZT': 'cycling-mountain', // Cyklotrasy terénní
		'CZS': 'cycling-road',     // Cyklotrasy silniční
		'VZT': 'wheelchair'        // Vozíčkářské trasy
	};
	return mapping[druhPresunu] || 'foot-hiking';
}

// Build OpenRouteService routing request
function buildORSRouteRequest(points: any[], druhPresunu: string) {
	if (points.length < 2) throw new Error("Musí být alespoň dva body!");

	const profile = mapDruhPresunuToORSProfile(druhPresunu);
	const coordinates = points.map(p => [p.lon, p.lat]);

	return {
		url: `https://api.openrouteservice.org/v2/directions/${profile}/geojson`,
		body: {
			coordinates: coordinates
		}
	};
}

// Tvorba správné URL pro routing API
function buildMapyRouteUrl(body: any[], apiKey: string, type: string) {
	if (body.length < 2) throw new Error("Musí být alespoň dva body!");
	const [start, ...rest] = body;
	const end = rest.length ? rest[rest.length - 1] : start;
	const waypoints = rest.length > 1 ? rest.slice(0, -1) : [];
	const url = new URL("https://api.mapy.cz/v1/routing/route");
	url.searchParams.append("start", `${start.lon}`);
	url.searchParams.append("start", `${start.lat}`);
	url.searchParams.append("end", `${end.lon}`);
	url.searchParams.append("end", `${end.lat}`);
	url.searchParams.append("routeType", `${type}`);
	url.searchParams.append("lang", "cs");
	url.searchParams.append("format", "geojson");
	url.searchParams.append("avoidToll", "false");
	url.searchParams.append("apikey", apiKey);
	waypoints.forEach(({lat, lon}: any) => {
		url.searchParams.append("waypoints", `${lon},${lat}`);
	});
	return url.toString();
}

// Tvorba odkazu pro jeden bod (marker):
function getMapyCzShowMapUrl(lon: number, lat: number, mapset: string) {
	if (typeof lon !== "number" || typeof lat !== "number") return null;
	return `https://mapy.cz/fnc/v1/showmap?mapset=${mapset}&center=${lon},${lat}&zoom=16&marker=true`;
}

// Tvorba odkazu pro trasu (start, end, waypoints):
function getMapyCzRouteUrl(points: any[], mapset: string, type: string) {
	if (!Array.isArray(points) || points.length < 2) return null;
	const [start, ...rest] = points;
	const end = rest.length ? rest[rest.length - 1] : start;
	const waypoints = rest.length > 1 ? rest.slice(0, -1) : [];
	const waypointsParam = waypoints.length
		? "&waypoints=" +
		waypoints.map((w: any) => `${w.lon},${w.lat}`).join(";")
		: "";
	return (
		`https://mapy.cz/fnc/v1/route?mapset=` + mapset +
		`&start=${start.lon},${start.lat}` +
		`&end=${end.lon},${end.lat}` +
		`&routeType=` + type +
		waypointsParam
	);
}

interface MapaTrasy {
	data: {
		title?: string;
		points: Array<{
			lat: number;
			lon: number;
			content: React.ReactNode;
		}>;
		route: boolean;
		druhPresunu?: string;
	};
}

export function MapaTrasy({data: {title = '', points, route, druhPresunu = 'PZT'}}: MapaTrasy) {
	// Mapování druhPresunu na mapset a type pro Mapy.cz
	const mapset = druhPresunu === "LZT" ? "winter" : "outdoor";
	const type = druhPresunu === "CZT" ? "bike_mountain" :
		druhPresunu === "CZS" ? "bike_road" : "foot_fast";
	const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Rozdělení bodů na platné/neplatné
	const validPoints = points.filter(isValidPoint);
	const invalidPoints = points.filter(p => !isValidPoint(p));

	useEffect(() => {
		if (!route || !validPoints || validPoints.length < 2) return;

		// Pro lyžařské trasy nezobrazujeme routing
		if (druhPresunu === 'LZT') {
			setRouteCoords([]);
			setLoading(false);
			return;
		}

		setLoading(true);
		setError(null);

		// Try OpenRouteService first
		const orsRequest = buildORSRouteRequest(validPoints, druhPresunu);

		fetch(orsRequest.url, {
			method: 'POST',
			headers: {
				'Authorization': OPEN_ROUTE_KEY,
				'Content-Type': 'application/json',
				'Accept': 'application/json, application/geo+json'
			},
			body: JSON.stringify(orsRequest.body)
		})
			.then(r => {
				if (!r.ok) throw new Error("ORS API error");
				return r.json();
			})
			.then(data => {
				// Process ORS response
				let coords: [number, number][] = [];
				if (data?.features?.[0]?.geometry?.coordinates) {
					coords = data.features[0].geometry.coordinates.map(
						([lon, lat]: [number, number]) => [lat, lon] as [number, number]
					);
				}
				setRouteCoords(coords);
				setLoading(false);
			})
			.catch(orsError => {
				// Fallback to Mapy.cz API
				console.warn('OpenRouteService failed, falling back to Mapy.cz:', orsError);

				const url = buildMapyRouteUrl(validPoints, MAPY_API_KEY, type);
				fetch(url)
					.then(r => {
						if (!r.ok) throw new Error("Chyba API");
						return r.json();
					})
					.then(data => {
						let coords: [number, number][] = [];
						if (
							data?.geometry?.geometry?.type === "LineString" &&
							Array.isArray(data.geometry.geometry.coordinates)
						) {
							coords = data.geometry.geometry.coordinates.map(
								([lon, lat]: [number, number]) => [lat, lon] as [number, number]
							);
						}
						setRouteCoords(coords);
						setLoading(false);
					})
					.catch(e => {
						setError("Nepodařilo se načíst trasu.");
						setRouteCoords([]);
						setLoading(false);
					});
			});
		// eslint-disable-next-line
	}, [JSON.stringify(validPoints), route, druhPresunu]);

	const center: [number, number] = validPoints[0]
		? [validPoints[0].lat, validPoints[0].lon]
		: [49.8, 14.8];
	const height = window.innerWidth > 768 ? 500 : 350;

	const alertIcon = <IconAlertTriangleFilled/>;

	return (
		<Box style={{minHeight: height, width: "100%", position: "relative"}}>
			<Group justify="space-between" mb="sm">
				<Title order={3}>{title}</Title>
				{!loading && route && validPoints.length >= 2 && (
					<Button
						leftSection={<IconMapShare size={14}/>}
						component="a"
						target="_blank"
						href={getMapyCzRouteUrl(validPoints, mapset, type) || undefined}
						color="green"
						variant="outline"
						size="sm"
					>
						Mapy.cz
					</Button>
				)}
			</Group>
			{loading && <Loader/>}
			{validPoints.length > 0 && (
				<>
					<MapContainer
						style={{height: height, width: "100%", zIndex: 1}}
						center={center}
						zoom={13}
						scrollWheelZoom={false}
					>
						<TileLayer
							url={`https://api.mapy.cz/v1/maptiles/${mapset}/256/{z}/{x}/{y}?apikey=${MAPY_API_KEY}`}
							attribution='Mapové podklady © <a href="https://www.seznam.cz/">Seznam.cz, a.s.</a> a další'
						/>
						{validPoints.map((point, i) => (
							<Marker
								key={"valid" + i}
								position={[point.lat, point.lon]}
								icon={signIcon}
							>
								<Popup>
									{point.content}
									<Button
										leftSection={<IconMapShare size={14}/>}
										component="a"
										target="_blank"
										href={getMapyCzShowMapUrl(point.lon, point.lat, mapset) || undefined}
										color="green"
										variant="outline"
										size="compact-xs"
									>
										Mapy.cz
									</Button>
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
									<p color="red">Neplatný bod:</p>
									{point.content}
									<Button
										leftSection={<IconMapShare size={14}/>}
										component="a"
										target="_blank"
										href={getMapyCzShowMapUrl(point.lon, point.lat, mapset) || undefined}
										color="green"
										variant="outline"
										size="compact-xs"
									>
										Mapy.cz
									</Button>
								</Popup>
							</Marker>
						))}
						{route && routeCoords.length > 1 && (
							<Polyline positions={routeCoords} color="#2266cc" weight={5}/>
						)}
						<FitBounds points={validPoints}/>
					</MapContainer>
					{route && routeCoords.length > 1 ? druhPresunu === 'LZT' ? (
						<Alert variant="light" color="blue" icon={alertIcon}>
							Pro lyžařské trasy se zobrazují pouze pozice TIM. Trasa se neznázorňuje z důvodu nekompatibility s vyhledáváním tras.
							Pro orientaci jsou aktuální lyžařské trasy vyobrazeny na mapě.
						</Alert>
					) : (
						<Alert variant="light" color="yellow" icon={alertIcon}>
							Mapa je pouze orientační a nemusí zcela souhlasit s trasou. Vždy dbejte na správné umístění trasy i prvků.
						</Alert>
					) : null}
				</>
			)}
			{error && <Alert variant="light" color="red" icon={alertIcon}> {error} </Alert>}
			{invalidPoints.length > 0 && (
				<Alert variant="light" color="red" title="Body s neplatnými souřadnicemi" icon={alertIcon}>
					<ul>
						{invalidPoints.map((point, idx) => (
							<li key={idx}>
								{point.content || (
									<Text size="sm">
										{JSON.stringify(point)}
									</Text>
								)}
							</li>
						))}
					</ul>
				</Alert>
			)}
		</Box>
	);
}

export default MapaTrasy;