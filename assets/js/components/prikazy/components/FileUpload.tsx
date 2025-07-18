import React, { useState, useRef, useEffect } from "react";
import {
	Box,
	Group,
	Text,
	Card,
	ActionIcon,
	Button,
	Stack,
	Image,
	Grid,
	Modal,
	Alert,
	Progress
} from "@mantine/core";
import {
	IconUpload,
	IconTrash,
	IconEye,
	IconFile,
	IconCamera,
	IconX,
	IconCheck,
	IconCameraOff,
	IconCapture,
	IconRepeat,
	IconRotateClockwise,
	IconRotate2
} from "@tabler/icons-react";
import { Dropzone, FileWithPath } from "@mantine/dropzone";
import { useAuth } from "@components/auth/AuthContext";
import { useMediaQuery } from "@mantine/hooks";
import { FileAttachment } from "../types/HlaseniTypes";
import { notifications } from "@mantine/notifications";

interface FileUploadProps {
	files: FileAttachment[];
	onFilesChange: (files: FileAttachment[]) => void;
	maxFiles?: number;
	maxSize?: number; // v MB
	accept?: string;
	disabled?: boolean;
	id?: string;
	enableCamera?: boolean;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export const FileUpload: React.FC<FileUploadProps> = ({
	files,
	onFilesChange,
	maxFiles = 5,
	maxSize = 10,
	accept = "image/jpeg,image/png,image/heic,application/pdf",
	disabled = false,
	id = 'default',
	enableCamera = true
}) => {
	const { user } = useAuth();
	const [uploading, setUploading] = useState(false);
	const isMobile = useMediaQuery('(max-width: 50em)');
	
	// Camera states
	const [cameraOpen, setCameraOpen] = useState(false);
	const [stream, setStream] = useState<MediaStream | null>(null);
	const [cameraError, setCameraError] = useState<string | null>(null);
	const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
	const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
	const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
	const videoRef = useRef<HTMLVideoElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);

	// Preview modal states
	const [previewFile, setPreviewFile] = useState<FileAttachment | null>(null);
	const [rotationAngle, setRotationAngle] = useState(0);

	useEffect(() => {
		return () => {
			if (stream) {
				stream.getTracks().forEach(track => track.stop());
			}
		};
	}, [stream]);

	const isImage = (filename: string) => {
		return /\.(jpg|jpeg|png|gif|bmp|webp|heic)$/i.test(filename);
	};

	const convertHeicToJpeg = async (file: File): Promise<File> => {
		// TODO: Implementace konverze HEIC
		return file;
	};

	const compressImage = async (file: File, maxWidth = 1920, quality = 0.8): Promise<File> => {
		return new Promise((resolve) => {
			const canvas = document.createElement('canvas');
			const ctx = canvas.getContext('2d');
			const img = document.createElement('img');

			img.onload = () => {
				// Vypočítání nových rozměrů se zachováním poměru stran
				let { width, height } = img;
				if (width > maxWidth) {
					height = (height * maxWidth) / width;
					width = maxWidth;
				}

				canvas.width = width;
				canvas.height = height;

				// Kreslení a komprese
				ctx?.drawImage(img, 0, 0, width, height);
				
				// Vyčistíme URL aby nedošlo k memory leak
				URL.revokeObjectURL(img.src);
				
				canvas.toBlob((blob) => {
					if (blob) {
						// Použijeme blob s file properties místo File constructoru
						const compressedBlob: any = blob;
						compressedBlob.lastModifiedDate = new Date();
						compressedBlob.name = file.name.replace(/\.[^/.]+$/, '.jpg'); // Změníme příponu na .jpg
						resolve(compressedBlob as File);
					} else {
						resolve(file);
					}
				}, 'image/jpeg', quality);
			};

			img.onerror = () => {
				resolve(file); // V případě chyby vrátíme původní soubor
			};

			img.src = URL.createObjectURL(file);
		});
	};

	const uploadFile = async (file: FileWithPath | File): Promise<FileAttachment> => {
		let processedFile = file;

		// Konverze HEIC na JPEG
		const fileName = processedFile.name || (processedFile as any).name || 'unknown.jpg';
		if (fileName.toLowerCase().endsWith('.heic')) {
			processedFile = await convertHeicToJpeg(file);
		}

		// Komprese a resize obrázků
		if (isImage(fileName) && processedFile.size > 2 * 1024 * 1024) {
			processedFile = await compressImage(processedFile, 1920, 0.8);
		}

		const formData = new FormData();
		formData.append('file', processedFile);
		formData.append('uploadedBy', user?.name || 'unknown');
		formData.append('timestamp', new Date().toISOString());
		const url = URL.createObjectURL(processedFile);
		const thumbnailUrl = isImage(processedFile.name) ? url : undefined;

		const timestamp = Date.now();
		const random = Math.random().toString(36).substring(2);
		const uniqueId = `file_${id}_${timestamp}_${random}`;

		const fileAttachment: FileAttachment = {
			id: uniqueId,
			fileName: processedFile.name || (processedFile as any).name || fileName || `file-${timestamp}`,
			fileSize: processedFile.size || 0,
			fileType: processedFile.type || 'image/jpeg',
			uploadedAt: new Date(),
			uploadedBy: user?.name || 'unknown',
			url,
			thumbnailUrl,
			rotation: 0
		};

		return fileAttachment;
	};

	// Camera functions
	const startCamera = async () => {
		setCameraError(null);
		try {
			let constraints: MediaStreamConstraints = {
				video: {
					facingMode: facingMode,
					width: {ideal: 1920},
					height: {ideal: 1080}
				}
			};

			let mediaStream: MediaStream;
			try {
				mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
			} catch (error) {
				constraints = {
					video: {
						width: {ideal: 1920},
						height: {ideal: 1080}
					}
				};
				mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
			}

			setStream(mediaStream);
			setCameraOpen(true);

			setTimeout(() => {
				if (videoRef.current) {
					videoRef.current.srcObject = mediaStream;
					videoRef.current.play().catch(err => {});
				}
			}, 100);
		} catch (error) {
			setCameraError('Nepodařilo se spustit kameru. Zkontrolujte oprávnění pro kameru v nastavení prohlížeče.');
		}
	};

	const stopCamera = () => {
		if (stream) {
			stream.getTracks().forEach(track => track.stop());
			setStream(null);
		}
		setCameraOpen(false);
		setCameraError(null);
		setCapturedPhoto(null);
		setPhotoBlob(null);
	};

	const switchCamera = async () => {
		if (stream) {
			// Zastavíme aktuální stream
			stream.getTracks().forEach(track => track.stop());
			setStream(null);
		}

		const newFacingMode = facingMode === 'user' ? 'environment' : 'user';
		setFacingMode(newFacingMode);

		try {
			let mediaStream: MediaStream;
			try {
				mediaStream = await navigator.mediaDevices.getUserMedia({
					video: {
						facingMode: newFacingMode,
						width: {ideal: 1920},
						height: {ideal: 1080}
					}
				});
			} catch (error) {
				setCameraError('Zařízení nemá druhou kameru');
				return;
			}

			setStream(mediaStream);

			if (videoRef.current) {
				videoRef.current.srcObject = mediaStream;
				videoRef.current.play().catch(err => {});
			}
		} catch (error) {
			setCameraError('Nepodařilo se přepnout kameru.');
		}
	};

	const capturePhoto = async () => {
		if (!videoRef.current || !canvasRef.current) {
			setCameraError('Video nebo canvas není dostupný');
			return;
		}

		const video = videoRef.current;
		const canvas = canvasRef.current;
		const ctx = canvas.getContext('2d');

		if (!ctx) {
			setCameraError('Nepodařilo se získat kontext canvas');
			return;
		}

		// Zkontrolujeme, zda má video rozměry
		if (video.videoWidth === 0 || video.videoHeight === 0) {
			setCameraError('Video ještě není připraveno. Zkuste to znovu.');
			return;
		}

		canvas.width = video.videoWidth;
		canvas.height = video.videoHeight;

		ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

		canvas.toBlob((blob) => {
			if (blob) {
				const photoUrl = URL.createObjectURL(blob);
				setCapturedPhoto(photoUrl);
				setPhotoBlob(blob);
			} else {
				setCameraError('Nepodařilo se vytvořit foto');
			}
		}, 'image/jpeg', 0.8);
	};

	const confirmPhoto = async () => {
		if (!photoBlob) return;

		const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
		const filename = `foto-${timestamp}.jpg`;

		// Použijeme blob s file properties místo File constructoru
		const file: any = photoBlob;
		file.lastModifiedDate = new Date();
		file.name = filename;

		try {
			setUploading(true);
			setCameraError(null);
			const uploadedFile = await uploadFile(file);
			
			if (uploadedFile && uploadedFile.id && uploadedFile.fileName) {
				onFilesChange([...files, uploadedFile]);

				notifications.show({
					title: "Foto uloženo",
					message: `Foto ${filename} bylo úspěšně přidáno`,
					color: "green"
				});

				stopCamera();
			} else {
				throw new Error('Invalid file object returned from upload');
			}
		} catch (error) {
			notifications.show({
				title: "Chyba při ukládání",
				message: "Nepodařilo se uložit foto",
				color: "red"
			});
		} finally {
			setUploading(false);
		}
	};

	const discardPhoto = () => {
		try {
			if (capturedPhoto && capturedPhoto.startsWith('blob:')) {
				URL.revokeObjectURL(capturedPhoto);
			}
			setCapturedPhoto(null);
			setPhotoBlob(null);
		} catch (error) {
			// Tichá chyba při čištění URL
		}
	};

	// Rotation and preview functions
	const rotateImage = (fileId: string, degrees: number) => {
		const updatedFiles = files.map(f =>
			f.id === fileId
				? { ...f, rotation: (f.rotation || 0) + degrees }
				: f
		);
		onFilesChange(updatedFiles);
	};

	const openPreview = (file: FileAttachment) => {
		setPreviewFile(file);
		setRotationAngle(file.rotation || 0);
	};

	const isPdf = (filename: string) => {
		return /\.pdf$/i.test(filename);
	};

	const handleDrop = async (acceptedFiles: FileWithPath[]) => {
		if (!acceptedFiles || acceptedFiles.length === 0 || disabled || uploading) return;

		setUploading(true);
		try {
			const newFiles: FileAttachment[] = [];

			for (const file of acceptedFiles) {
				// Kontrola velikosti
				if (file.size > maxSize * 1024 * 1024) {
					notifications.show({
						title: "Soubor je příliš velký",
						message: `Soubor ${file.name} překračuje maximální velikost ${maxSize}MB`,
						color: "red"
					});
					continue;
				}

				// Kontrola počtu souborů
				if (files.length + newFiles.length >= maxFiles) {
					notifications.show({
						title: "Příliš mnoho souborů",
						message: `Můžete nahrát maximálně ${maxFiles} souborů`,
						color: "orange"
					});
					break;
				}

				try {
					if (isImage(file.name) && file.size > 2 * 1024 * 1024) {
						notifications.show({
							title: "Optimalizace obrázku",
							message: `Komprimování ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)...`,
							color: "blue",
							autoClose: 2000
						});
					}

					const uploadedFile = await uploadFile(file);
					if (uploadedFile && uploadedFile.id && uploadedFile.fileName) {
						newFiles.push(uploadedFile);
					} else {
						throw new Error('Invalid file object returned from upload');
					}

					if (isImage(file.name) && file.size > 2 * 1024 * 1024) {
						const savedMB = (file.size - uploadedFile.fileSize) / 1024 / 1024;
						if (savedMB > 0.5) {
							notifications.show({
								title: "Optimalizace dokončena",
								message: `${file.name}: Ušetřeno ${savedMB.toFixed(1)}MB dat`,
								color: "green",
								autoClose: 3000
							});
						}
					}
				} catch (error) {
					notifications.show({
						title: "Chyba uploadu",
						message: `Nepodařilo se nahrát soubor ${file.name}`,
						color: "red"
					});
				}
			}

			if (newFiles.length > 0) {
				onFilesChange([...files, ...newFiles]);
			}
		} catch (error) {
			notifications.show({
				title: "Nepředvídaná chyba",
				message: "Nastala chyba při zpracování souborů",
				color: "red"
			});
		} finally {
			setUploading(false);
		}
	};

	const removeFile = (fileId: string) => {
		try {
			const fileToRemove = files.find(f => f.id === fileId);
			if (fileToRemove) {
				// Lepší memory cleanup - uvolnění URL objektů
				if (fileToRemove.url && fileToRemove.url.startsWith('blob:')) {
					URL.revokeObjectURL(fileToRemove.url);
				}
				if (fileToRemove.thumbnailUrl && fileToRemove.thumbnailUrl.startsWith('blob:')) {
					URL.revokeObjectURL(fileToRemove.thumbnailUrl);
				}
			}
			
			const updatedFiles = files.filter(f => f.id !== fileId);
			onFilesChange(updatedFiles);
		} catch (error) {
			notifications.show({
				title: "Chyba při mazání",
				message: "Nepodařilo se smazat soubor",
				color: "red"
			});
		}
	};

	const FilePreview: React.FC<{ file: FileAttachment }> = ({ file }) => {
		if (isImage(file.fileName)) {
			return (
				<Card withBorder p="xs" style={{ position: 'relative' }}>
					<Box
						onClick={() => openPreview(file)}
						style={{ cursor: 'pointer' }}
					>
						<Image
							src={file.thumbnailUrl}
							alt={file.fileName}
							height={80}
							style={{
								transform: `rotate(${file.rotation || 0}deg)`,
								transition: 'transform 0.3s ease'
							}}
						/>
					</Box>
					{!isMobile && (
						<Group gap={4} mt={4}>
							<ActionIcon
								size="xs"
								variant="light"
								onClick={() => rotateImage(file.id, -90)}
								disabled={disabled}
							>
								<IconRotate2 size={12} />
							</ActionIcon>
							<ActionIcon
								size="xs"
								variant="light"
								onClick={() => rotateImage(file.id, 90)}
								disabled={disabled}
							>
								<IconRotateClockwise size={12} />
							</ActionIcon>
							<ActionIcon
								size="xs"
								variant="light"
								onClick={() => openPreview(file)}
							>
								<IconEye size={12} />
							</ActionIcon>
							<ActionIcon
								size="xs"
								color="red"
								variant="light"
								onClick={() => removeFile(file.id)}
								disabled={disabled}
							>
								<IconTrash size={12} />
							</ActionIcon>
						</Group>
					)}
				</Card>
			);
		}

		return (
			<Card withBorder p="xs" style={{ cursor: isMobile ? 'pointer' : 'default' }}>
				<Box onClick={isMobile ? () => openPreview(file) : undefined}>
					<Group gap="xs">
						<IconFile size={20} />
						<Stack gap={0}>
							<Text size="xs" truncate maw={120}>
								{file.fileName}
							</Text>
							<Text size="xs" c="dimmed">
								{(file.fileSize / 1024).toFixed(1)} KB
							</Text>
						</Stack>
					</Group>
				</Box>
				{!isMobile && (
					<Group gap={4} mt={4}>
						<ActionIcon
							size="xs"
							variant="light"
							onClick={() => openPreview(file)}
						>
							<IconEye size={12} />
						</ActionIcon>
						<ActionIcon
							size="xs"
							color="red"
							variant="light"
							onClick={() => removeFile(file.id)}
							disabled={disabled}
						>
							<IconTrash size={12} />
						</ActionIcon>
					</Group>
				)}
			</Card>
		);
	};

	return (
		<Box>
			{uploading && (
				<Progress value={100} animated mb="md" color="blue" />
			)}
			
			{!disabled && files.length < maxFiles && (
				<>
					<Text size="sm" c="dimmed" inline mb="sm">
						Maximálně {maxFiles} souborů, každý do {maxSize}MB
					</Text>
					<Group gap="md">
						<Dropzone
							flex="1"
							onDrop={handleDrop}
							accept={accept.split(',').reduce((acc, type) => {
								acc[type.trim()] = [];
								return acc;
							}, {} as Record<string, string[]>)}
							maxSize={maxSize * 1024 * 1024}
							loading={uploading}
							disabled={disabled}
							className="dropzone"
						>
							<Group justify="center" gap="xl" mih={150} style={{ pointerEvents: 'none' }}>
								<Dropzone.Accept>
									<IconUpload
										size={50}
										color="var(--mantine-color-blue-6)"
										stroke={1.5}
									/>
								</Dropzone.Accept>
								<Dropzone.Reject>
									<IconFile
										size={50}
										color="var(--mantine-color-red-6)"
										stroke={1.5}
									/>
								</Dropzone.Reject>
								<Dropzone.Idle>
									<IconUpload
										size={50}
										color="var(--mantine-color-dimmed)"
										stroke={1.5}
									/>
								</Dropzone.Idle>

								<div>
									<Text size="xl" inline>
										Přetáhněte soubory sem nebo klikněte pro výběr
									</Text>
								</div>
							</Group>
						</Dropzone>
						
						{enableCamera && 'mediaDevices' in navigator && (
							<Button
								mih={150}
								miw="20%"
								variant="default"
								size="lg"
								onClick={startCamera}
								disabled={disabled || uploading}
							>
								<Stack justify="center" align="center" gap="sm">
									<IconCamera size={50} color="var(--mantine-color-dimmed)"/>
									<Text size="md" c="dimmed">
										Vyfotit
									</Text>
								</Stack>
							</Button>
						)}
					</Group>
				</>
			)}

			{files.length > 0 && (
				<Box mt="md">
					<Text size="sm" fw={500} mb="xs">
						Nahrané soubory ({files.length}/{maxFiles})
					</Text>
					<Grid gutter="xs">
						{files.map((file) => (
							<Grid.Col key={file.id} span={3}>
								<FilePreview file={file} />
							</Grid.Col>
						))}
					</Grid>
				</Box>
			)}

			<Modal
				opened={!!previewFile}
				onClose={() => setPreviewFile(null)}
				title={previewFile?.fileName}
				size="90%"
				fullScreen={useMediaQuery('(max-width: 50em)')}
				centered
			>
				{previewFile && (
					<Stack>
						{isImage(previewFile.fileName) ? (
							<Box ta="center">
								<Image
									src={previewFile.url}
									alt={previewFile.fileName}
									fit="contain"
									style={{
										transform: `rotate(${rotationAngle}deg)`,
										transition: 'transform 0.3s ease',
										maxHeight: '70vh',
										width: '100%',
										height: 'auto'
									}}
								/>
								<Stack gap="md" mt="md">
									<Group justify="center">
										<Button
											variant="light"
											leftSection={<IconRotate2 size={16} />}
											onClick={() => setRotationAngle(prev => prev - 90)}
										>
											Otočit vlevo
										</Button>
										<Button
											variant="light"
											leftSection={<IconRotateClockwise size={16} />}
											onClick={() => setRotationAngle(prev => prev + 90)}
										>
											Otočit vpravo
										</Button>
										<Button
											color="green"
											leftSection={<IconCheck size={16} />}
											onClick={() => {
												rotateImage(previewFile.id, rotationAngle - (previewFile.rotation || 0));
												setPreviewFile(null);
											}}
										>
											Uložit rotaci
										</Button>
									</Group>
									<Group justify="center">
										<Button
											color="red"
											variant="light"
											leftSection={<IconTrash size={16} />}
											onClick={() => {
												removeFile(previewFile.id);
												setPreviewFile(null);
											}}
											disabled={disabled}
										>
											Smazat soubor
										</Button>
									</Group>
								</Stack>
							</Box>
						) : isPdf(previewFile.fileName) ? (
							<Box ta="center">
								<Text>PDF preview není dostupný v této verzi</Text>
								<Button
									component="a"
									href={previewFile.url}
									target="_blank"
									mt="md"
								>
									Otevřít PDF
								</Button>
							</Box>
						) : (
							<Box ta="center">
								<IconFile size={64} color="var(--mantine-color-gray-5)" />
								<Text mt="md">{previewFile.fileName}</Text>
								<Text size="sm" c="dimmed">
									{(previewFile.fileSize / 1024).toFixed(1)} KB
								</Text>
								<Button
									color="red"
									variant="light"
									leftSection={<IconTrash size={16} />}
									onClick={() => {
										removeFile(previewFile.id);
										setPreviewFile(null);
									}}
									disabled={disabled}
									mt="xl"
								>
									Smazat soubor
								</Button>
							</Box>
						)}
					</Stack>
				)}
			</Modal>

			<Modal
				opened={cameraOpen}
				onClose={stopCamera}
				withCloseButton={false}
				size="55rem"
				fullScreen={useMediaQuery('(max-width: 50em)')}
				centered
				padding="0"
			>
				<Stack>
					{cameraError ? (
						<Alert color="red" title="Chyba kamery">
							{cameraError}
						</Alert>
					) : capturedPhoto ? (
						<>
								<Box pos="relative" style={{ textAlign: 'center' }}>
								<Text size="lg" fw={500} mb="md">
									Zkontrolujte kvalitu fotky
								</Text>
								<Image
									src={capturedPhoto}
									alt="Zachycená fotka"
									style={{
										width: '100%',
										maxHeight: '70vh',
										objectFit: 'contain',
										border: '2px solid var(--mantine-color-gray-3)'
									}}
								/>
							</Box>

							<Group justify="center" gap="md" mb="md">
								<Button
									variant="light"
									color="red"
									leftSection={<IconX size={16} />}
									onClick={discardPhoto}
								>
									Vyfotit znovu
								</Button>

								<Button
									color="green"
									leftSection={<IconCheck size={16} />}
									onClick={confirmPhoto}
									loading={uploading}
								>
									Potvrdit
								</Button>
							</Group>
						</>
					) : (
						<>
								<Box pos="relative" style={{ textAlign: 'center' }}>
								<video
									ref={videoRef}
									autoPlay
									playsInline
									muted
									style={{
										width: '100%',
										maxHeight: '80vh',
										objectFit: 'cover',
									}}
								/>
								<canvas
									ref={canvasRef}
									style={{ display: 'none' }}
								/>
							</Box>

							<Group justify="center" gap="md" mb="md">
								<ActionIcon
									variant="light"
									size="lg"
									radius="xl"
									aria-label="Přepnout kameru"
									onClick={switchCamera}
								>
									<IconRepeat style={{ width: '70%', height: '70%' }} stroke={1.5} />
								</ActionIcon>

								<ActionIcon
									size="xl"
									radius="xl"
									aria-label="Zachytit foto"
									onClick={capturePhoto}
								>
									<IconCapture style={{ width: '70%', height: '70%' }} stroke={1.5} />
								</ActionIcon>

								<ActionIcon
									variant="light"
									size="lg"
									radius="xl"
									color="red"
									aria-label="Zavřít kameru"
									onClick={stopCamera}
								>
									<IconCameraOff style={{ width: '70%', height: '70%' }} stroke={1.5} />
								</ActionIcon>
							</Group>
						</>
					)}
				</Stack>
			</Modal>
		</Box>
	);
};