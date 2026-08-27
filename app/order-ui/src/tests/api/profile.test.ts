import { httpMock, httpAuthMock } from '../__mocks__/httpMock'
import { describe, it, expect, beforeEach, vi, Mock } from 'vitest'
import {
  getProfile,
  updateProfile,
  updatePassword,
  uploadProfilePicture,
} from '@/api'
import { SERVER_ERROR } from '../constants'
import { Role } from '@/constants/role'

// getProfile gọi http (trend, cần merge role/branch) — đổi/avatar vẫn gọi
// httpAuth (shared-user) — xem progress/trend-ui.md giai đoạn 1.
vi.mock('@/utils', () => ({
  http: httpMock,
  httpAuth: httpAuthMock,
}))

describe('Profile API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getProfile', () => {
    it('should fetch user profile correctly', async () => {
      const mockResponse = {
        data: {
          slug: 'user-1',
          image: 'profile.jpg',
          phonenumber: '1234567890',
          firstName: 'John',
          lastName: 'Doe',
          dob: '1990-01-01',
          email: 'john@example.com',
          address: '123 Street',
          branch: {
            slug: 'branch-1',
            name: 'Main Branch',
            address: 'Branch Address',
          },
          role: {
            name: Role.ADMIN,
            slug: 'admin',
            createdAt: '2024-01-01',
            description: 'Administrator',
          },
          isVerifiedEmail: true,
          isVerifiedPhonenumber: true,
        },
      }
      ;(httpMock.get as Mock).mockResolvedValue(mockResponse)

      const result = await getProfile()
      expect(httpMock.get).toHaveBeenCalledWith('/auth/profile')
      expect(result).toEqual(mockResponse.data)
    })

    it('should handle server error', async () => {
      ;(httpMock.get as Mock).mockRejectedValue(SERVER_ERROR)
      await expect(getProfile()).rejects.toEqual(SERVER_ERROR)
    })
  })

  describe('updateProfile', () => {
    const updateData = {
      firstName: 'John',
      lastName: 'Smith',
      dob: '1990-01-01',
      address: 'New Address',
      branch: 'branch-2',
    }

    it('should update profile correctly', async () => {
      const mockResponse = {
        data: {
          slug: 'user-1',
          ...updateData,
        },
      }
      ;(httpAuthMock.patch as Mock).mockResolvedValue(mockResponse)

      const result = await updateProfile(updateData)
      expect(httpAuthMock.patch).toHaveBeenCalledWith('/auth/profile', updateData)
      expect(result).toEqual(mockResponse.data)
    })

    it('should handle validation error', async () => {
      const mockError = {
        response: {
          status: 400,
          data: { message: 'Invalid profile data' },
        },
      }
      ;(httpAuthMock.patch as Mock).mockRejectedValue(mockError)
      await expect(updateProfile(updateData)).rejects.toEqual(mockError)
    })
  })

  describe('updatePassword', () => {
    const passwordData = {
      oldPassword: 'oldpass123',
      newPassword: 'newpass123',
    }

    it('should update password correctly', async () => {
      const mockResponse = {
        data: {
          message: 'Password updated successfully',
        },
      }
      ;(httpAuthMock.post as Mock).mockResolvedValue(mockResponse)

      const result = await updatePassword(passwordData)
      expect(httpAuthMock.post).toHaveBeenCalledWith(
        '/auth/change-password',
        passwordData,
      )
      expect(result).toEqual(mockResponse.data)
    })

    it('should handle incorrect old password', async () => {
      const mockError = {
        response: {
          status: 400,
          data: { message: 'Incorrect old password' },
        },
      }
      ;(httpAuthMock.post as Mock).mockRejectedValue(mockError)
      await expect(updatePassword(passwordData)).rejects.toEqual(mockError)
    })
  })

  describe('uploadProfilePicture', () => {
    it('should upload profile picture correctly', async () => {
      const mockFile = new File(['test'], 'profile.jpg', { type: 'image/jpeg' })
      const mockResponse = {
        data: {
          slug: 'user-1',
          image: 'new-profile-picture.jpg',
        },
      }
      ;(httpAuthMock.patch as Mock).mockResolvedValue(mockResponse)

      const result = await uploadProfilePicture(mockFile)
      expect(httpAuthMock.patch).toHaveBeenCalledWith(
        '/auth/upload',
        expect.any(FormData),
      )
      expect(result).toEqual(mockResponse.data)
    })

    it('should handle file upload error', async () => {
      const mockFile = new File(['test'], 'profile.jpg', { type: 'image/jpeg' })
      const mockError = {
        response: {
          status: 400,
          data: { message: 'Invalid file format' },
        },
      }
      ;(httpAuthMock.patch as Mock).mockRejectedValue(mockError)
      await expect(uploadProfilePicture(mockFile)).rejects.toEqual(mockError)
    })

    it('should handle server error during upload', async () => {
      const mockFile = new File(['test'], 'profile.jpg', { type: 'image/jpeg' })
      ;(httpAuthMock.patch as Mock).mockRejectedValue(SERVER_ERROR)
      await expect(uploadProfilePicture(mockFile)).rejects.toEqual(SERVER_ERROR)
    })
  })
})
