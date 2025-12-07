import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Loader2, Wrench } from 'lucide-react';
import { z } from 'zod';
const emailSchema = z.string().email('Email inválido');
const passwordSchema = z.string().min(6, 'Senha deve ter no mínimo 6 caracteres');
const nomeSchema = z.string().min(2, 'Nome deve ter no mínimo 2 caracteres');
export default function Auth() {
  const navigate = useNavigate();
  const {
    signIn,
    signUp,
    user
  } = useAuth();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('login');

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Signup form state
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupNome, setSignupNome] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');

  // Redirect if already logged in
  if (user) {
    navigate('/');
    return null;
  }
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      emailSchema.parse(loginEmail);
      passwordSchema.parse(loginPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
        return;
      }
    }
    setLoading(true);
    const {
      error
    } = await signIn(loginEmail, loginPassword);
    setLoading(false);
    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        toast.error('Email ou senha incorretos');
      } else {
        toast.error('Erro ao fazer login: ' + error.message);
      }
      return;
    }
    toast.success('Login realizado com sucesso!');
    navigate('/');
  };
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      nomeSchema.parse(signupNome);
      emailSchema.parse(signupEmail);
      passwordSchema.parse(signupPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
        return;
      }
    }
    if (signupPassword !== signupConfirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }
    setLoading(true);
    const {
      error
    } = await signUp(signupEmail, signupPassword, signupNome);
    setLoading(false);
    if (error) {
      if (error.message.includes('User already registered')) {
        toast.error('Este email já está cadastrado');
      } else {
        toast.error('Erro ao criar conta: ' + error.message);
      }
      return;
    }
    toast.success('Conta criada com sucesso!');
    navigate('/');
  };
  return <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4">
      
    </div>;
}