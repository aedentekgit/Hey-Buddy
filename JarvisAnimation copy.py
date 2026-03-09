import sys
import os
from PyQt5.QtWidgets import QApplication, QMainWindow, QLabel, QVBoxLayout, QWidget
from PyQt5.QtGui import QMovie
from PyQt5.QtCore import Qt, QSize

# Directory paths
current_dir = os.path.dirname(os.path.abspath(__file__))
GraphicsDirPath = os.path.join(current_dir, "Frontend", "Graphics")
GifPath = os.path.join(GraphicsDirPath, "Jarvis.gif")

class JARVISAnimationWindow(QMainWindow):
    def __init__(self):
        super().__init__()

        # Set window properties: Frameless, stay on top, transparent background
        self.setWindowFlags(Qt.FramelessWindowHint | Qt.WindowStaysOnTopHint)
        self.setAttribute(Qt.WA_TranslucentBackground)

        # Main Layout
        self.central_widget = QWidget()
        self.setCentralWidget(self.central_widget)
        self.layout = QVBoxLayout(self.central_widget)
        self.layout.setContentsMargins(0, 0, 0, 0)

        # Animation Label
        self.gif_label = QLabel(self)
        self.layout.addWidget(self.gif_label)

        # Load the JARVIS GIF
        if os.path.exists(GifPath):
            self.movie = QMovie(GifPath)
            
            # Get screen size to make it look premium
            screen = QApplication.primaryScreen().geometry()
            screen_width = screen.width()
            screen_height = screen.height()

            # Scale to a nice size (e.g., 60% of screen width)
            width = int(screen_width * 0.6)
            height = int(width / 1.77) # Maintain 16:9 aspect ratio
            
            self.movie.setScaledSize(QSize(width, height))
            self.gif_label.setMovie(self.movie)
            self.movie.start()
            
            # Center the window
            self.setGeometry((screen_width - width) // 2, (screen_height - height) // 2, width, height)
        else:
            self.gif_label.setText("JARVIS.gif not found in Frontend/Graphics/")
            self.gif_label.setStyleSheet("color: cyan; font-size: 20px;")
            self.setGeometry(100, 100, 400, 100)

    def mousePressEvent(self, event):
        # Allow closing the standalone animation by clicking it
        if event.button() == Qt.LeftButton:
            self.close()

if __name__ == "__main__":
    app = QApplication(sys.argv)
    window = JARVISAnimationWindow()
    window.show()
    sys.exit(app.exec_())
