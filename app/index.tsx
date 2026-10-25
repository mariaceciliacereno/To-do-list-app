import { supabase } from '@/utils/supabase';
import type { Session, User } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';

export interface TodoItem {
  id: string;
  user_id: string;
  task: string;
  is_completed: boolean;
  created_at: string;
}

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Auth State
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  // Auth Form State
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authInfo, setAuthInfo] = useState<string | null>(null);

  // Todo App State
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [newTodoText, setNewTodoText] = useState('');
  const [loadingTodos, setLoadingTodos] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [addingTodo, setAddingTodo] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');

  // Theme colors
  const colors = {
    bg: isDark ? '#0F1117' : '#F6F8FA',
    card: isDark ? '#1A1D24' : '#FFFFFF',
    text: isDark ? '#FFFFFF' : '#111827',
    textSecondary: isDark ? '#9CA3AF' : '#6B7280',
    border: isDark ? '#2D333F' : '#E5E7EB',
    inputBg: isDark ? '#232731' : '#F3F4F6',
    primary: '#24B47E', // Supabase green
    danger: '#EF4444',
    itemBg: isDark ? '#1F232D' : '#F9FAFB',
  };

  // Listen to Auth Changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setCheckingSession(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Fetch todos whenever user logs in
  useEffect(() => {
    if (user) {
      fetchTodos();
    } else {
      setTodos([]);
    }
  }, [user]);

  // Fetch Todos from Supabase
  const fetchTodos = async () => {
    setLoadingTodos(true);
    try {
      const { data, error } = await supabase
        .from('todos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching todos:', error.message);
        Alert.alert('Database Notice', `${error.message}\n\nPlease make sure the "todos" table is created in your Supabase SQL Editor.`);
      } else if (data) {
        setTodos(data as TodoItem[]);
      }
    } catch (err: any) {
      console.error('Fetch error:', err);
    } finally {
      setLoadingTodos(false);
      setRefreshing(false);
    }
  };

  // Add a new Todo
  const handleAddTodo = async () => {
    const trimmed = newTodoText.trim();
    if (!trimmed || !user) return;

    setAddingTodo(true);
    try {
      const { data, error } = await supabase
        .from('todos')
        .insert([{ task: trimmed, user_id: user.id }])
        .select()
        .single();

      if (error) {
        Alert.alert('Error adding todo', error.message);
      } else if (data) {
        setTodos((prev) => [data as TodoItem, ...prev]);
        setNewTodoText('');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Failed to add item');
    } finally {
      setAddingTodo(false);
    }
  };

  // Toggle complete state
  const handleToggleComplete = async (todo: TodoItem) => {
    const updatedStatus = !todo.is_completed;

    // Optimistic UI update
    setTodos((prev) =>
      prev.map((item) => (item.id === todo.id ? { ...item, is_completed: updatedStatus } : item))
    );

    const { error } = await supabase
      .from('todos')
      .update({ is_completed: updatedStatus })
      .eq('id', todo.id);

    if (error) {
      Alert.alert('Update Failed', error.message);
      // Revert on error
      setTodos((prev) =>
        prev.map((item) => (item.id === todo.id ? { ...item, is_completed: todo.is_completed } : item))
      );
    }
  };

  // Delete a Todo
  const handleDeleteTodo = async (id: string) => {
    // Optimistic UI update
    const previousTodos = [...todos];
    setTodos((prev) => prev.filter((item) => item.id !== id));

    const { error } = await supabase.from('todos').delete().eq('id', id);

    if (error) {
      Alert.alert('Delete Failed', error.message);
      setTodos(previousTodos);
    }
  };

  // Auth: Sign In
  const handleSignIn = async () => {
    if (!email.trim() || !password) {
      setAuthError('Please enter both email and password.');
      return;
    }
    setAuthError(null);
    setAuthInfo(null);
    setAuthLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) setAuthError(error.message);
    setAuthLoading(false);
  };

  // Auth: Sign Up
  const handleSignUp = async () => {
    if (!email.trim() || !password) {
      setAuthError('Please enter both email and password.');
      return;
    }
    if (password.length < 6) {
      setAuthError('Password must be at least 6 characters.');
      return;
    }
    setAuthError(null);
    setAuthInfo(null);
    setAuthLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    if (error) {
      setAuthError(error.message);
    } else if (data.session) {
      setAuthInfo('Account created and signed in!');
    } else {
      setAuthInfo('Account created! Please check your email to verify.');
    }
    setAuthLoading(false);
  };

  // Auth: Sign Out
  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) Alert.alert('Sign Out Error', error.message);
  };

  if (checkingSession) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // ==========================================
  // 1. UNAUTHENTICATED SCREEN (Sign In / Up)
  // ==========================================
  if (!session || !user) {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.authScroll, { backgroundColor: colors.bg }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.iconCircle}>
              <Text style={styles.iconText}>✓</Text>
            </View>

            <Text style={[styles.title, { color: colors.text }]}>
              {isSignUp ? 'Create Supabase Account' : 'Welcome to Supabase Todos'}
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {isSignUp ? 'Sign up to sync your tasks across devices' : 'Sign in to access your personal database tasks'}
            </Text>

            {authError && (
              <View style={styles.errorAlert}>
                <Text style={styles.errorAlertText}>{authError}</Text>
              </View>
            )}

            {authInfo && (
              <View style={styles.infoAlert}>
                <Text style={styles.infoAlertText}>{authInfo}</Text>
              </View>
            )}

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Email Address</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                placeholder="you@example.com"
                placeholderTextColor={colors.textSecondary}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Password</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                placeholder="••••••••"
                placeholderTextColor={colors.textSecondary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: colors.primary }]}
              onPress={isSignUp ? handleSignUp : handleSignIn}
              disabled={authLoading}
              activeOpacity={0.8}
            >
              {authLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {isSignUp ? 'Create Account' : 'Sign In'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toggleRow}
              onPress={() => {
                setIsSignUp((prev) => !prev);
                setAuthError(null);
                setAuthInfo(null);
              }}
            >
              <Text style={[styles.toggleText, { color: colors.textSecondary }]}>
                {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
                <Text style={{ color: colors.primary, fontWeight: '700' }}>
                  {isSignUp ? 'Sign In' : 'Sign Up'}
                </Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ==========================================
  // 2. AUTHENTICATED SCREEN (Full Supabase Todo App)
  // ==========================================
  const filteredTodos = todos.filter((item) => {
    if (filter === 'active') return !item.is_completed;
    if (filter === 'completed') return item.is_completed;
    return true;
  });

  const completedCount = todos.filter((t) => t.is_completed).length;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Top Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>My Tasks</Text>
            <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
              {user.email}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.signOutSmallBtn, { borderColor: colors.border }]}
            onPress={handleSignOut}
          >
            <Text style={[styles.signOutSmallText, { color: colors.danger }]}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        {/* Add Todo Input Bar */}
        <View style={styles.addBar}>
          <TextInput
            style={[
              styles.addInput,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
            placeholder="Add a new task..."
            placeholderTextColor={colors.textSecondary}
            value={newTodoText}
            onChangeText={setNewTodoText}
            onSubmitEditing={handleAddTodo}
            returnKeyType="done"
          />
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: colors.primary }]}
            onPress={handleAddTodo}
            disabled={addingTodo || !newTodoText.trim()}
            activeOpacity={0.8}
          >
            {addingTodo ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.addButtonText}>Add</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Filter Tabs & Stats */}
        <View style={styles.filterRow}>
          <View style={styles.segmentedControl}>
            {(['all', 'active', 'completed'] as const).map((tab) => {
              const active = filter === tab;
              return (
                <TouchableOpacity
                  key={tab}
                  style={[
                    styles.segmentButton,
                    active && { backgroundColor: colors.primary },
                  ]}
                  onPress={() => setFilter(tab)}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      { color: active ? '#FFFFFF' : colors.textSecondary },
                    ]}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[styles.counterText, { color: colors.textSecondary }]}>
            {completedCount}/{todos.length} done
          </Text>
        </View>

        {/* Todos FlatList */}
        <FlatList
          data={filteredTodos}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchTodos();
              }}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            loadingTodos ? (
              <View style={styles.emptyContainer}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.emptyText, { color: colors.textSecondary, marginTop: 8 }]}>
                  Loading tasks from Supabase...
                </Text>
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>🎉</Text>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>No tasks found</Text>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  {filter === 'all'
                    ? 'Type a task above and tap "Add" to save it to your database.'
                    : `No ${filter} tasks right now.`}
                </Text>
              </View>
            )
          }
          renderItem={({ item }) => (
            <View
              style={[
                styles.todoCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
            >
              {/* Checkbox */}
              <TouchableOpacity
                style={[
                  styles.checkbox,
                  item.is_completed
                    ? { backgroundColor: colors.primary, borderColor: colors.primary }
                    : { borderColor: colors.border },
                ]}
                onPress={() => handleToggleComplete(item)}
                activeOpacity={0.7}
              >
                {item.is_completed && <Text style={styles.checkIcon}>✓</Text>}
              </TouchableOpacity>

              {/* Task Text */}
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 4 }}
                onPress={() => handleToggleComplete(item)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.todoTaskText,
                    {
                      color: item.is_completed ? colors.textSecondary : colors.text,
                      textDecorationLine: item.is_completed ? 'line-through' : 'none',
                    },
                  ]}
                >
                  {item.task}
                </Text>
              </TouchableOpacity>

              {/* Delete Button */}
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDeleteTodo(item.id)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.deleteIconText}>✕</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  safeArea: {
    flex: 1,
  },
  authScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#24B47E20',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  iconText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#24B47E',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },
  formGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  primaryButton: {
    height: 46,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  toggleRow: {
    marginTop: 18,
    alignItems: 'center',
  },
  toggleText: {
    fontSize: 13,
  },
  errorAlert: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  errorAlertText: {
    color: '#DC2626',
    fontSize: 13,
  },
  infoAlert: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  infoAlertText: {
    color: '#059669',
    fontSize: 13,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 40 : 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  signOutSmallBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  signOutSmallText: {
    fontSize: 12,
    fontWeight: '600',
  },
  addBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 10,
  },
  addInput: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  addButton: {
    width: 68,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#00000010',
    borderRadius: 8,
    padding: 3,
  },
  segmentButton: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '600',
  },
  counterText: {
    fontSize: 12,
    fontWeight: '500',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 28,
  },
  todoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkIcon: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  todoTaskText: {
    fontSize: 15,
    fontWeight: '500',
  },
  deleteButton: {
    padding: 6,
  },
  deleteIconText: {
    fontSize: 15,
    color: '#9CA3AF',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    paddingHorizontal: 24,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});
