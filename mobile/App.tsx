import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Screens
import LoginScreen from './src/screens/LoginScreen';
import HostsScreen from './src/screens/HostsScreen';
import TerminalScreen from './src/screens/TerminalScreen';
import SFTPScreen from './src/screens/SFTPScreen';
import SettingsScreen from './src/screens/SettingsScreen';

// Store
import { useAuthStore } from './src/stores/authStore';

const queryClient = new QueryClient();
const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function HomeTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#0ea5e9',
        tabBarInactiveTintColor: '#64748b',
        tabBarStyle: {
          backgroundColor: '#0f172a',
          borderTopColor: '#1e293b',
        },
        headerStyle: {
          backgroundColor: '#0f172a',
        },
        headerTintColor: '#ffffff',
      }}
    >
      <Tab.Screen
        name="Hosts"
        component={HostsScreen}
        options={{
          title: 'Hosts',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="server" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Terminal"
        component={TerminalScreen}
        options={{
          title: 'Terminal',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="terminal" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="SFTP"
        component={SFTPScreen}
        options={{
          title: 'Files',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="folder" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="settings" color={color} size={size} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

function TabIcon({ name, color, size }: { name: string; color: string; size: number }) {
  // Simple icon placeholder - in production use @expo/vector-icons
  return null;
}

export default function App() {
  const { isAuthenticated } = useAuthStore();

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <NavigationContainer>
          <Stack.Navigator
            screenOptions={{
              headerStyle: {
                backgroundColor: '#0f172a',
              },
              headerTintColor: '#ffffff',
            }}
          >
            {!isAuthenticated ? (
              <Stack.Screen
                name="Login"
                component={LoginScreen}
                options={{ headerShown: false }}
              />
            ) : (
              <Stack.Screen
                name="Home"
                component={HomeTabs}
                options={{ headerShown: false }}
              />
            )}
          </Stack.Navigator>
        </NavigationContainer>
        <StatusBar style="light" />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
