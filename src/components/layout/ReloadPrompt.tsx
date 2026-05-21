/// <reference types="vite-plugin-pwa/react" />
import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

export function ReloadPrompt() {
  const { toast } = useToast();
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered');
    },
    onRegisterError(error) {
      console.log('SW registration error', error);
    },
  });

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  useEffect(() => {
    if (needRefresh) {
      const { id, dismiss } = toast({
        title: "Nova versão disponível",
        description: "Uma nova atualização do sistema foi carregada.",
        action: (
          <Button 
            variant="default" 
            size="sm" 
            onClick={() => {
              updateServiceWorker(true);
              dismiss();
            }}
            className="flex items-center gap-2 bg-primary hover:bg-primary/90"
          >
            <RefreshCw className="h-4 w-4" />
            Atualizar Agora
          </Button>
        ),
        duration: Infinity,
      });
    }
    
    if (offlineReady) {
      toast({
        title: "App pronto para uso offline",
        description: "O sistema agora pode ser acessado sem internet.",
      });
      setOfflineReady(false);
    }
  }, [needRefresh, offlineReady, updateServiceWorker, toast, setOfflineReady, setNeedRefresh]);

  return null;
}
