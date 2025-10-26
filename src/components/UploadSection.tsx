import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Upload, FileCode, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface UploadSectionProps {
  userId: string;
}

const UploadSection = ({ userId }: UploadSectionProps) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    // Validate file
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
      toast.error('File size exceeds 100MB limit');
      return;
    }

    // TODO: Validate APK file signature
    const validExtensions = ['.apk'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    if (!validExtensions.includes(fileExtension)) {
      toast.error('Only APK files are allowed');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      // Upload to storage
      const filePath = `${userId}/${Date.now()}_${file.name}`;
      setUploadProgress(50); // Show progress during upload
      const { error: uploadError } = await supabase.storage
        .from('apk-files')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Create analysis job
      const { error: jobError } = await supabase
        .from('analysis_jobs')
        .insert({
          user_id: userId,
          filename: file.name,
          file_size: file.size,
          storage_path: filePath,
          status: 'pending',
          progress: 0,
        });

      if (jobError) throw jobError;

      toast.success('APK uploaded successfully! Analysis queued.');
      setUploadProgress(0);
      
      // TODO: Trigger background analysis pipeline
      // This would call an edge function to start the analysis
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  }, [userId]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.android.package-archive': ['.apk'],
    },
    maxFiles: 1,
    disabled: uploading,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Upload className="w-5 h-5" />
          <span>Upload APK</span>
        </CardTitle>
        <CardDescription>
          Upload an Android APK file for comprehensive security analysis
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          {...getRootProps()}
          className={`
            border-2 border-dashed rounded-lg p-12 text-center cursor-pointer
            transition-all duration-200
            ${isDragActive 
              ? 'border-primary bg-primary/5' 
              : 'border-border hover:border-primary/50 hover:bg-card/50'
            }
            ${uploading ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center space-y-4">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <FileCode className="w-8 h-8 text-primary" />
            </div>
            {uploading ? (
              <div className="w-full max-w-xs space-y-2">
                <p className="text-sm font-medium">Uploading... {uploadProgress}%</p>
                <Progress value={uploadProgress} className="h-2" />
              </div>
            ) : (
              <>
                <div>
                  <p className="text-lg font-medium">
                    {isDragActive ? 'Drop APK file here' : 'Drag & drop APK file'}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    or click to browse (max 100MB)
                  </p>
                </div>
                <Button variant="secondary" size="sm">
                  Select File
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="mt-4 p-4 bg-warning/10 border border-warning/20 rounded-lg">
          <div className="flex items-start space-x-2">
            <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-warning">Security Notice</p>
              <p className="text-muted-foreground mt-1">
                Uploaded APK files will be analyzed using MobSF, VirusTotal, and optional sandbox environments.
                Rate limiting: 10 uploads per hour.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default UploadSection;