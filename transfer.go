package vfs

import (
	"path"
	"strings"
	"uuid"
)

// TransferPath는 자기 자신과 상하위 경로 사이의 전송을 차단합니다.
func TransferPath(src Meta, dst string) (string, error) {
	dst = path.Clean("/" + strings.TrimSpace(dst))
	source := path.Clean(src.Path)
	if source == "/" || dst == "/" || source == dst ||
		strings.HasPrefix(source, dst+"/") ||
		(src.IsDir && strings.HasPrefix(dst, source+"/")) ||
		strings.ContainsAny(dst, "\\\x00") {
		return "", ErrInvalidPath
	}
	if src.IsDir {
		dst += "/"
	}
	return dst, nil
}

// CheckReplacement는 선택적으로 전달된 대상 UUID 조건을 원자적 교체 전에 검사합니다.
func CheckReplacement(target *Meta, replaceID []uuid.UUID) error {
	if len(replaceID) == 0 {
		return nil
	}
	expected := replaceID[0]
	if target == nil {
		if expected != uuid.Nil() {
			return ErrAlreadyExists
		}
		return nil
	}
	if expected == uuid.Nil() || target.ID != expected {
		return ErrAlreadyExists
	}
	return nil
}
