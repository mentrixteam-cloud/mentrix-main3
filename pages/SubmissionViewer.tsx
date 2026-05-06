import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Loader2, ExternalLink, Download, Maximize2 } from 'lucide-react';

interface Assignment {
  id: string;
  title: string;
  file_name: string;
  file_path: string;
  students?: {
    first_name: string;
    last_name: string;
  } | null;
}

const isImage = (ext: string) => ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'].includes(ext.toLowerCase());
const isPdf = (ext: string) => ext.toLowerCase() === 'pdf';

const SubmissionViewer = () => {
  const { assignmentId } = useParams() as { assignmentId?: string };
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mediaRef = useRef<HTMLIFrameElement | HTMLImageElement | null>(null);

  useEffect(() => {
    if (!assignmentId) return;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: queryError } = await supabase
          .from('student_assignments')
          .select('*, students(first_name, last_name)')
          .eq('id', assignmentId)
          .maybeSingle();

        if (queryError) throw queryError;
        if (!data) {
          setError('Submission not found');
          return;
        }
        setAssignment(data as Assignment);

        const filePath = (data as any).file_path;
        const { data: signed, error: signErr } = await supabase.storage
          .from('student-assignments')
          .createSignedUrl(filePath, 300);
        if (signErr) throw signErr;
        setUrl(signed?.signedUrl ?? null);
      } catch (err) {
        console.error('Viewer load error', err);
        const message = err instanceof Error ? err.message : String(err);
        setError(message || 'Failed to load submission');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [assignmentId]);

  const ext = assignment?.file_name?.split('.').pop() || '';

  const handleDownload = () => {
    if (!url) return;
    try {
      const a = document.createElement('a');
      a.href = url;
      a.download = assignment?.file_name ?? '';
      a.target = '_blank';
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      console.error('Download failed, opening in new tab', err);
      window.open(url, '_blank', 'noopener');
    }
  };

  const handleFullscreen = async () => {
    try {
      const el = mediaRef.current as unknown as HTMLElement | null;
      if (el && el.requestFullscreen) {
        await el.requestFullscreen();
      }
    } catch (err) {
      console.error('Fullscreen failed', err);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{assignment?.title || 'Submission Viewer'}</h1>
            <p className="text-sm text-muted-foreground">
              {assignment?.students ? `${assignment.students.first_name} ${assignment.students.last_name}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => navigate(-1)}>Back</Button>
            {url && (
              <>
                <Button variant="outline" onClick={() => window.open(url, '_blank', 'noopener')}>
                  <ExternalLink className="h-4 w-4 mr-2" />Open in new tab
                </Button>
                <Button variant="outline" onClick={handleDownload}>
                  <Download className="h-4 w-4" />
                </Button>
                <Button variant="outline" onClick={handleFullscreen}>
                  <Maximize2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="bg-card rounded-md p-4">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : error ? (
            <div className="p-6 text-center text-muted-foreground">{error}</div>
          ) : url ? (
            isPdf(ext) ? (
              <iframe ref={(el) => (mediaRef.current = el)} src={url} className="w-full h-[80vh] border" title="PDF Submission" />
            ) : isImage(ext) ? (
              // eslint-disable-next-line jsx-a11y/img-redundant-alt
              <img ref={(el) => (mediaRef.current = el)} src={url} alt={`Submission ${assignment?.file_name}`} className="w-full h-auto max-h-[80vh] object-contain" />
            ) : (
              <div className="p-6 text-center">
                <p className="mb-4">Preview unavailable for this file type.</p>
                <Button onClick={() => window.open(url || '', '_blank')}>Open in new tab / Download</Button>
              </div>
            )
          ) : (
            <div className="p-6 text-center text-muted-foreground">No preview available</div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default SubmissionViewer;
