import React, {useEffect} from 'react';
import {useAuth} from './AuthContext';
import LoginForm from './LoginForm';
import {Loader, Center} from '@mantine/core';

type RequireLoginProps = {
	required?: boolean;
	children: React.ReactNode;
	onLoginSuccess?: () => void;
};

const RequireLogin: React.FC<RequireLoginProps> = ({
													   required = true,
													   children,
													   onLoginSuccess,
												   }) => {
	const {loggedIn, isUserLoading} = useAuth();

	if (!required) {
		return <>{children}</>;
	}

	// Zobrazit loader během ověřování
	if (isUserLoading) {
		return (
			<Center style={{ height: '100vh' }}>
				<Loader size="lg" />
			</Center>
		);
	}

	if (!loggedIn) {
		return <LoginForm onSuccess={onLoginSuccess}/>;
	}

	return <>{children}</>;
};

export default RequireLogin;