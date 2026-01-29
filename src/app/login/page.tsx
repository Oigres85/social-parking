"use client";

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, initiateEmailSignIn, initiateEmailSignUp, useAuth } from '@/firebase';
import ParkingSymbol from '@/components/icons/ParkingSymbol';
import { LoaderCircle } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email({ message: 'Inserisci un indirizzo email valido.' }),
  password: z.string().min(6, { message: 'La password deve contenere almeno 6 caratteri.' }),
});

const registerSchema = z.object({
  name: z.string().min(2, { message: 'Il nome deve contenere almeno 2 caratteri.' }),
  email: z.string().email({ message: 'Inserisci un indirizzo email valido.' }),
  password: z.string().min(6, { message: 'La password deve contenere almeno 6 caratteri.' }),
});

type LoginFormValues = z.infer<typeof loginSchema>;
type RegisterFormValues = z.infer<typeof registerSchema>;

export default function LoginPage() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("login");

  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const registerForm = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '' },
  });

  useEffect(() => {
    if (!isUserLoading && user) {
      router.push('/');
    }
  }, [user, isUserLoading, router]);

  const handleLogin = async (data: LoginFormValues) => {
    if (!auth) return;
    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, data.email, data.password);
      toast({ title: 'Accesso effettuato con successo!' });
      // Redirect is handled by useEffect
    } catch (error: any) {
      toast({
        title: 'Errore di accesso',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (data: RegisterFormValues) => {
    if (!auth || !firestore) return;
    setIsLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      const newUser = userCredential.user;
      
      // Create user document in Firestore
      await setDoc(doc(firestore, "users", newUser.uid), {
        id: newUser.uid,
        email: data.email,
        name: data.name,
        isSearching: false,
        latitude: null,
        longitude: null,
      });

      toast({ title: 'Registrazione completata!', description: 'Ora puoi effettuare l\'accesso.' });
      setActiveTab("login");
    } catch (error: any) {
      toast({
        title: 'Errore di registrazione',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  if (isUserLoading || user) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <LoaderCircle className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <main className="flex h-screen w-full items-center justify-center bg-background p-4">
      <div className="flex flex-col items-center gap-6 w-full max-w-sm">
        <ParkingSymbol className="w-20 h-20 text-primary" />
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Accedi</TabsTrigger>
            <TabsTrigger value="register">Registrati</TabsTrigger>
          </TabsList>
          <TabsContent value="login">
            <Card>
              <CardHeader>
                <CardTitle>Bentornato</CardTitle>
                <CardDescription>Accedi per trovare e condividere parcheggi.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input id="login-email" type="email" placeholder="mario.rossi@email.com" {...loginForm.register('email')} />
                    {loginForm.formState.errors.email && <p className="text-xs text-destructive">{loginForm.formState.errors.email.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Password</Label>
                    <Input id="login-password" type="password" {...loginForm.register('password')} />
                    {loginForm.formState.errors.password && <p className="text-xs text-destructive">{loginForm.formState.errors.password.message}</p>}
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                    Accedi
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="register">
            <Card>
              <CardHeader>
                <CardTitle>Crea un account</CardTitle>
                <CardDescription>Unisciti alla community per un parcheggio più semplice.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={registerForm.handleSubmit(handleRegister)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="register-name">Nome</Label>
                    <Input id="register-name" placeholder="Mario Rossi" {...registerForm.register('name')} />
                     {registerForm.formState.errors.name && <p className="text-xs text-destructive">{registerForm.formState.errors.name.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-email">Email</Label>
                    <Input id="register-email" type="email" placeholder="mario.rossi@email.com" {...registerForm.register('email')} />
                     {registerForm.formState.errors.email && <p className="text-xs text-destructive">{registerForm.formState.errors.email.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-password">Password</Label>
                    <Input id="register-password" type="password" {...registerForm.register('password')} />
                     {registerForm.formState.errors.password && <p className="text-xs text-destructive">{registerForm.formState.errors.password.message}</p>}
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                    Registrati
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
