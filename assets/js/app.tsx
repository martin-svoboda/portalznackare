import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './components/App';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import 'mantine-react-table/styles.css';

import {MantineProvider, createTheme} from '@mantine/core';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {BrowserRouter} from 'react-router-dom';
import {HelmetProvider} from 'react-helmet-async';
import {AuthProvider} from '@components/auth/AuthContext';
import {Notifications} from "@mantine/notifications";

// Vytvoření Query Client
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: 1,
            staleTime: 5 * 60 * 1000, // 5 minut
        },
    },
});

document.addEventListener('DOMContentLoaded', () => {
    const rootElement = document.querySelector('[data-app="portal"]');
    if (!rootElement) {
        console.error("Element [data-app='portal'] nebyl nalezen.");
        return;
    }

    const theme = createTheme({
        // Globální barvy
        primaryColor: 'blue',
        
        // Defaultní hodnoty komponent
        defaultRadius: 'sm',
        
        // Komponenty s různými styly pro light/dark
        components: {
            Paper: {
                defaultProps: {
                    shadow: 'sm',
                },
                styles: {
                    root: {
                        backgroundColor: 'light-dark(var(--mantine-color-white), var(--mantine-color-dark-7))',
                    },
                },
            },
            Card: {
                defaultProps: {
                    shadow: 'sm',
                },
                styles: {
                    root: {
                        backgroundColor: 'light-dark(var(--mantine-color-white), var(--mantine-color-dark-7))',
                    },
                },
            },
            Button: {
                defaultProps: {
                    radius: 'sm',
                },
            },
            // Základní styly pro všechny inputy
            Input: {
                defaultProps: {
                    radius: 'sm',
                },
                styles: {
                    input: {
                        backgroundColor: 'light-dark(var(--mantine-color-blue-light), var(--mantine-color-dark-6))',
                        // borderColor: 'light-dark(var(--mantine-color-gray-6), var(--mantine-color-dark-2))',
                        // '&:focus': {
                        //     borderColor: 'var(--mantine-color-blue-5)',
                        // },
                        // '&:hover:not(:focus)': {
                        //     borderColor: 'light-dark(var(--mantine-color-gray-8), var(--mantine-color-dark-1))',
                        // },
                    },
                },
            },
            // Tyto styly se aplikují na TextInput, NumberInput, PasswordInput, atd.
            TextInput: {
                defaultProps: {
                    radius: 'sm',
                },
            },
            Select: {
                defaultProps: {
                    radius: 'sm',
                },
            },
            MultiSelect: {
                defaultProps: {
                    radius: 'sm',
                },
            },
            Textarea: {
                defaultProps: {
                    radius: 'sm',
                },
            },
            NumberInput: {
                defaultProps: {
                    radius: 'sm',
                },
            },
            PasswordInput: {
                defaultProps: {
                    radius: 'sm',
                },
            },
            DateInput: {
                defaultProps: {
                    radius: 'sm',
                },
            },
            DatePicker: {
                defaultProps: {
                    radius: 'sm',
                },
            },
            AppShell: {
                styles: {
                    main: {
                        backgroundColor: 'light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-8))',
                    },
                    header: {
                        backgroundColor: 'light-dark(var(--mantine-color-white), var(--mantine-color-dark-7))',
                    },
                    navbar: {
                        backgroundColor: 'light-dark(var(--mantine-color-white), var(--mantine-color-dark-7))',
                    },
                },
            },
        },
    });

    const root = createRoot(rootElement);
    root.render(
        <QueryClientProvider client={queryClient}>
            <HelmetProvider>
                <BrowserRouter>
                    <MantineProvider theme={theme} defaultColorScheme="auto">
                        <AuthProvider>
                            <Notifications/>
                            <App/>
                        </AuthProvider>
                    </MantineProvider>
                </BrowserRouter>
            </HelmetProvider>
        </QueryClientProvider>
    );
});
