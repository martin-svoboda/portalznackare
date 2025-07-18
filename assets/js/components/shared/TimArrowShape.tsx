import React from "react";

type TimArrowShapeProps = {
	color: string;
	shape?: string;
};

export const TimArrowShape = ({
								  color,
								  shape = "PA",
							  }: TimArrowShapeProps) => {

	switch (shape) {
		case "PA":
		case "CT":
		case "DO":
			return (
				<svg width={40} height={25} viewBox="0 0 40 25">
					<polygon
						points="0,0 0,25 40,25 40,0"
						fill={color}
					/>
				</svg>
			);
		case "NS":
		case "SN":
			return (
				<svg width={25} height={25} viewBox="0 0 26 26">
					<rect x="0.905" y="0.758" width="24.979" height="25.018" fill={color}/>
					<path
						d="M1.621,7.261l17.864,17.864l-17.864,-0l0,-17.864Zm23.526,12.102l-17.865,-17.864l17.865,-0l-0,17.864Z"
						fill="#fff"/>
				</svg>
			);
		case "Z":
			return (
				<svg width={40} height={26} viewBox="0 0 26 26">
					<path d="M13.481,13.21l0,-12.407l-12.407,-0l-0,24.815l24.815,0l0,-12.408l-12.408,0Z"
						  fill={color}/>
				</svg>
			);
		case "S":
			return (
				<svg width={40} height={26} viewBox="0 0 26 26">
					<path
						d="M25.624,11.825l0,0.005c0,7.029 -5.56,12.735 -12.409,12.735c-6.849,0 -12.409,-5.706 -12.409,-12.735l-0,-0.005l24.818,-0Z"
						fill={color}/>
				</svg>
			);
		case "V":
			return (
				<svg width={40} height={26} viewBox="0 0 26 26">
					<path d="M12.948,2.405l12.355,22.649l-24.709,0l12.354,-22.649Z" fill={color}/>
				</svg>
			);
		case "P":
			return (
				<svg width={40} height={26} viewBox="0 0 26 26">
					<path d="M17.664,13.21l-0,-9.964l-9.964,0l-0,9.964l-7.532,0l0,9.964l25.056,0l-0,-9.964l-7.56,0Z"
						  fill={color}/>
				</svg>
			);
		case "MI":
			return (
				<svg width={40} height={26} viewBox="0 0 26 26">
					<rect x="0.02" y="0.758" width="24.979" height="25.018" fill={color}/>
					<path d="M0.649,1.151l24.06,24.06l-24.06,0l-0,-24.06Z" style={{fill:"#fff"}}/>
				</svg>
			);
		case "VO":
			return (
				<svg width={40} height={26} viewBox="0 0 26 26">
					<path
						d="M16.717,22.218c-1.353,2.067 -3.689,3.433 -6.342,3.433c-4.181,0 -7.575,-3.394 -7.575,-7.575c-0,-2.91 1.643,-5.439 4.052,-6.707l0.437,2.925c-1.096,0.895 -1.796,2.257 -1.796,3.782c0,2.694 2.188,4.881 4.882,4.881c2.651,0 4.811,-2.117 4.88,-4.752l1.462,4.013Zm-10.465,-17.219c-0.195,-0.391 -0.304,-0.833 -0.304,-1.3c-0,-1.617 1.312,-2.93 2.929,-2.93c1.617,0 2.93,1.313 2.93,2.93c-0,1.465 -1.078,2.68 -2.483,2.896l0.636,4.184l5.916,-0.056l-0.023,2.403l-5.51,0.019l0.084,0.675l6.745,-0.003l3.01,8.478l2.61,-0.815l0.668,1.955l-5.327,1.621l-2.951,-8.397l-7.303,-0.005l-1.627,-11.655Z"
						fill={color}/>
				</svg>
			);
		default:
			return null;
	}
};